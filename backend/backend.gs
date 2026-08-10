/**
 * Jlaw Associates - Ops backend. Single Apps Script file, bound to the
 * Google Sheet that serves as the entire database (one tab per "table",
 * created by setupDatabase() below).
 *
 * Single entry point for the Web App. doGet is a trivial health check;
 * every real action goes through doPost as
 *   { action: "matters.create", token: "<session token or null>", payload: {...} }
 * sent with Content-Type: text/plain;charset=utf-8 (NOT application/json)
 * so the browser treats it as a CORS "simple request" and skips the
 * preflight OPTIONS call that Apps Script Web Apps cannot answer.
 *
 * Response envelope:
 *   success: { ok: true, data: {...} }
 *   error:   { ok: false, error: { code, message, details } }
 *
 * Deploy as: Execute as "Me", Access "Anyone" (required so the
 * unauthenticated auth.login call can reach it). Because the transport
 * itself is unauthenticated, every non-public action verifies the token
 * and the caller's role INSIDE the script - never trust a client-supplied
 * role/userId that isn't inside a signed token.
 *
 * File contents, in order:
 *   1. Errors
 *   2. Utils
 *   3. Sheet DB (generic CRUD over the spreadsheet)
 *   4. Auth (password hashing, session tokens, login/user management)
 *   5. Config & Holidays
 *   6. TAT / working-time algorithm
 *   7. Matters (FMS state machine)
 *   8. Court punches
 *   9. Independent tasks
 *   10. Scoring
 *   11. Dashboards
 *   12. Router (ACTIONS_ dispatch table, doGet/doPost)
 *   13. Setup - run setup() once from the Apps Script editor
 *   14. Self-tests (run runSelfTests() manually from the Apps Script editor)
 */

// =====================================================================
// 1. Errors
// =====================================================================

/**
 * Typed application error. Thrown by any handler; caught centrally in
 * doPost and converted into the {ok:false, error:{...}} envelope.
 */
function AppError_(code, message, details) {
  this.code = code;
  this.message = message;
  this.details = details || null;
}
AppError_.prototype = Object.create(Error.prototype);
AppError_.prototype.constructor = AppError_;

// =====================================================================
// 2. Utils
// =====================================================================

function nowIso_() {
  return new Date().toISOString();
}

function requireRole_(auth, roles) {
  if (!auth || roles.indexOf(auth.role) === -1) {
    throw new AppError_('FORBIDDEN', 'Insufficient permissions for this action');
  }
}

/**
 * Filters rows to those whose `field` (an ISO datetime/date string) falls
 * within [fromDate, toDate] inclusive. Either bound may be omitted.
 * ISO strings compare correctly lexicographically, so this is a plain
 * string comparison rather than a Date parse.
 */
function filterByDateRange_(rows, field, fromDate, toDate) {
  if (!fromDate && !toDate) return rows;
  return rows.filter(function (r) {
    var v = r[field];
    if (!v) return false;
    if (fromDate && v < fromDate) return false;
    if (toDate && v > toDate) return false;
    return true;
  });
}

/**
 * Read-through cache over CacheService (shared across all users/executions,
 * unlike a per-request variable). Used only for reads that are (a) hit on
 * nearly every page load and (b) rarely change - config, holidays, the
 * employee directory - never for Matters/Tasks/ScoreLedger, which mutate
 * constantly and would just show stale state to the person who just
 * changed them. Every write path that touches a cached read calls
 * invalidateCache_/invalidateCaches_ immediately, so the cache never
 * outlives the data it holds beyond its TTL as a worst case.
 */
function cachedRead_(key, ttlSeconds, computeFn) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(key);
  if (cached !== null) return JSON.parse(cached);
  var result = computeFn();
  cache.put(key, JSON.stringify(result), ttlSeconds);
  return result;
}

function invalidateCache_(key) {
  CacheService.getScriptCache().remove(key);
}

function invalidateCaches_(keys) {
  CacheService.getScriptCache().removeAll(keys);
}

// =====================================================================
// 3. Sheet DB - generic header-mapped CRUD helpers over the bound sheet.
// Every "table" is a sheet tab whose row 1 is the header row; every
// handler elsewhere in this file reads/writes rows as plain objects
// keyed by header name, so column reordering in the sheet never breaks
// a handler as long as the header names stay the same.
// =====================================================================

function getSheet_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new AppError_('SERVER_ERROR', 'Sheet not found: ' + sheetName);
  return sheet;
}

function getHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

function rowToObject_(headers, rowArray) {
  var obj = {};
  headers.forEach(function (h, i) {
    obj[h] = rowArray[i];
  });
  return obj;
}

function objectToRow_(headers, obj) {
  return headers.map(function (h) {
    return obj.hasOwnProperty(h) ? obj[h] : '';
  });
}

function getAllRows(sheetName) {
  var sheet = getSheet_(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var headers = getHeaders_(sheet);
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values
    .filter(function (row) {
      // skip fully-blank rows (can happen at the tail of a pre-sized sheet)
      return row.some(function (cell) {
        return cell !== '' && cell !== null;
      });
    })
    .map(function (row) {
      return rowToObject_(headers, row);
    });
}

function findRows(sheetName, predicate) {
  return getAllRows(sheetName).filter(predicate);
}

function findOne(sheetName, predicate) {
  var rows = findRows(sheetName, predicate);
  return rows.length ? rows[0] : null;
}

function findById(sheetName, idField, idValue) {
  return findOne(sheetName, function (r) {
    return r[idField] === idValue;
  });
}

function appendRow(sheetName, obj) {
  var sheet = getSheet_(sheetName);
  var headers = getHeaders_(sheet);
  sheet.appendRow(objectToRow_(headers, obj));
  return obj;
}

/**
 * Merges `updates` onto the row matched by idField===idValue and writes
 * the full row back. Returns the merged object, or null if no row matched.
 */
function updateById(sheetName, idField, idValue, updates) {
  var sheet = getSheet_(sheetName);
  var headers = getHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var idColIndex = headers.indexOf(idField);
  if (idColIndex === -1) {
    throw new AppError_('SERVER_ERROR', 'Missing id field "' + idField + '" in sheet ' + sheetName);
  }
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][idColIndex] === idValue) {
      var rowObj = rowToObject_(headers, values[i]);
      Object.keys(updates).forEach(function (k) {
        rowObj[k] = updates[k];
      });
      sheet.getRange(i + 2, 1, 1, headers.length).setValues([objectToRow_(headers, rowObj)]);
      return rowObj;
    }
  }
  return null;
}

function deleteById_(sheetName, idField, idValue) {
  var sheet = getSheet_(sheetName);
  var headers = getHeaders_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var idColIndex = headers.indexOf(idField);
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][idColIndex] === idValue) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

/**
 * Lock-protected sequential ID generator for Matters/Tasks, e.g. M-000123.
 * Backed by the SEQ_MATTER / SEQ_TASK keys in the Config sheet.
 */
function nextId_(kind) {
  var key = kind === 'MATTER' ? 'SEQ_MATTER' : 'SEQ_TASK';
  var prefix = kind === 'MATTER' ? 'M-' : 'T-';
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var current = Number(getConfigValue_(key) || 0);
    var next = current + 1;
    setConfigValue_(key, String(next));
    return prefix + Utilities.formatString('%06d', next);
  } finally {
    lock.releaseLock();
  }
}

// =====================================================================
// 4. Auth - custom email+password auth. Passwords are salted+hashed
// (SHA-256) into the Users sheet. A successful login gets a hand-built
// HMAC-signed, JWT-like token (header.payload.signature, base64url) that
// the frontend stores and sends back as `token` in every request body.
// There is no built-in JWT library in Apps Script, so this is implemented
// directly with Utilities.computeHmacSha256Signature.
// =====================================================================

// ---- base64url + HMAC helpers ----

function base64UrlEncode_(str) {
  return Utilities.base64EncodeWebSafe(Utilities.newBlob(str).getBytes()).replace(/=+$/, '');
}

function base64UrlDecode_(str) {
  var padded = str;
  while (padded.length % 4 !== 0) padded += '=';
  var bytes = Utilities.base64DecodeWebSafe(padded);
  return Utilities.newBlob(bytes).getDataAsString();
}

function signHmac_(input, secret) {
  var sigBytes = Utilities.computeHmacSha256Signature(input, secret);
  return Utilities.base64EncodeWebSafe(sigBytes).replace(/=+$/, '');
}

function getJwtSecret_() {
  var secret = PropertiesService.getScriptProperties().getProperty('JWT_SECRET');
  if (!secret) {
    throw new AppError_('SERVER_ERROR', 'JWT_SECRET is not configured. Run setupJwtSecret() once from the Apps Script editor.');
  }
  return secret;
}

// ---- password hashing ----

function makeSalt_() {
  return Utilities.getUuid();
}

function hashPassword_(password, salt) {
  var digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + ':' + salt);
  return digestBytes
    .map(function (b) {
      return ('0' + (b & 0xff).toString(16)).slice(-2);
    })
    .join('');
}

// ---- token issuance / verification ----

function createToken_(user) {
  var secret = getJwtSecret_();
  var now = Math.floor(Date.now() / 1000);
  var ttlHours = Number(getConfigValue_('SESSION_TTL_HOURS') || 12);
  var exp = now + ttlHours * 3600;
  var jti = Utilities.getUuid();

  // name/email are included (not just sub/role) so the frontend can restore
  // a full display-ready user object by decoding this payload locally on
  // page load, instead of round-tripping through auth.me every time - see
  // frontend/lib/apiClient.ts decodeToken(). Not a security boundary either
  // way: every real data-fetching action still re-verifies the signature,
  // expiry, session-not-revoked, and user-still-active server-side.
  var headerEnc = base64UrlEncode_(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  var payloadEnc = base64UrlEncode_(
    JSON.stringify({ sub: user.userId, name: user.name, email: user.email, role: user.role, jti: jti, iat: now, exp: exp })
  );
  var signingInput = headerEnc + '.' + payloadEnc;
  var token = signingInput + '.' + signHmac_(signingInput, secret);

  appendRow('Sessions', {
    jti: jti,
    userId: user.userId,
    issuedAt: nowIso_(),
    expiresAt: new Date(exp * 1000).toISOString(),
    revoked: false,
    userAgent: ''
  });

  return token;
}

/**
 * Verifies signature, expiry, session-not-revoked, and user-still-active.
 * Returns {userId, role, jti, name, email} on success; throws
 * AppError_('UNAUTHORIZED', ...) on any failure.
 */
function verifyToken_(token) {
  if (!token || typeof token !== 'string') throw new AppError_('UNAUTHORIZED', 'Missing token');
  var parts = token.split('.');
  if (parts.length !== 3) throw new AppError_('UNAUTHORIZED', 'Malformed token');

  var secret = getJwtSecret_();
  var expectedSig = signHmac_(parts[0] + '.' + parts[1], secret);
  if (expectedSig !== parts[2]) throw new AppError_('UNAUTHORIZED', 'Invalid token signature');

  var payload;
  try {
    payload = JSON.parse(base64UrlDecode_(parts[1]));
  } catch (e) {
    throw new AppError_('UNAUTHORIZED', 'Malformed token payload');
  }

  var now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) throw new AppError_('UNAUTHORIZED', 'Token expired, please log in again');

  var cache = CacheService.getScriptCache();
  var sessionCacheKey = 'session_' + payload.jti;
  var cachedSession = cache.get(sessionCacheKey);
  var sessionValid;
  if (cachedSession !== null) {
    sessionValid = cachedSession === '1';
  } else {
    var session = findById('Sessions', 'jti', payload.jti);
    sessionValid = !!session && session.revoked !== true;
    cache.put(sessionCacheKey, sessionValid ? '1' : '0', 300);
  }
  if (!sessionValid) throw new AppError_('UNAUTHORIZED', 'Session has been revoked, please log in again');

  var user = getUserCached_(payload.sub);
  if (!user || user.status !== 'ACTIVE') throw new AppError_('UNAUTHORIZED', 'User account is inactive');
  if (user.role !== payload.role) throw new AppError_('UNAUTHORIZED', 'Role changed, please log in again');

  return { userId: user.userId, role: user.role, jti: payload.jti, name: user.name, email: user.email };
}

function getUserCached_(userId) {
  var cache = CacheService.getScriptCache();
  var key = 'user_' + userId;
  var cached = cache.get(key);
  if (cached !== null) return JSON.parse(cached);
  var user = findById('Users', 'userId', userId);
  if (user) cache.put(key, JSON.stringify(user), 300);
  return user;
}

function invalidateUserCache_(userId) {
  CacheService.getScriptCache().remove('user_' + userId);
}

function publicUser_(user) {
  return { userId: user.userId, name: user.name, email: user.email, role: user.role, status: user.status };
}

// ---- action handlers ----

function login_(payload) {
  var email = String(payload.email || '').trim().toLowerCase();
  var password = String(payload.password || '');
  if (!email || !password) throw new AppError_('VALIDATION_ERROR', 'Email and password are required');

  var user = findOne('Users', function (u) {
    return String(u.email).toLowerCase() === email;
  });
  if (!user || user.status !== 'ACTIVE') throw new AppError_('UNAUTHORIZED', 'Invalid email or password');

  var hash = hashPassword_(password, user.passwordSalt);
  if (hash !== user.passwordHash) throw new AppError_('UNAUTHORIZED', 'Invalid email or password');

  var token = createToken_(user);
  updateById('Users', 'userId', user.userId, { lastLoginAt: nowIso_() });
  invalidateUserCache_(user.userId);

  return { token: token, user: publicUser_(user) };
}

function logout_(auth) {
  updateById('Sessions', 'jti', auth.jti, { revoked: true });
  CacheService.getScriptCache().put('session_' + auth.jti, '0', 300);
  return { ok: true };
}

function changePassword_(auth, payload) {
  var oldPassword = String(payload.oldPassword || '');
  var newPassword = String(payload.newPassword || '');
  if (newPassword.length < 8) throw new AppError_('VALIDATION_ERROR', 'New password must be at least 8 characters');

  var user = findById('Users', 'userId', auth.userId);
  if (hashPassword_(oldPassword, user.passwordSalt) !== user.passwordHash) {
    throw new AppError_('UNAUTHORIZED', 'Current password is incorrect');
  }

  var salt = makeSalt_();
  updateById('Users', 'userId', auth.userId, { passwordSalt: salt, passwordHash: hashPassword_(newPassword, salt) });
  invalidateUserCache_(auth.userId);
  return { ok: true };
}

// ---- admin: user management ----

function adminCreateUser_(auth, payload) {
  var name = String(payload.name || '').trim();
  var email = String(payload.email || '').trim().toLowerCase();
  var role = payload.role;
  var initialPassword = String(payload.initialPassword || '');

  if (!name || !email || !initialPassword) throw new AppError_('VALIDATION_ERROR', 'name, email and initialPassword are required');
  if (initialPassword.length < 8) throw new AppError_('VALIDATION_ERROR', 'initialPassword must be at least 8 characters');
  if (['FOUNDER_ADMIN', 'EMPLOYEE'].indexOf(role) === -1) throw new AppError_('VALIDATION_ERROR', 'role must be FOUNDER_ADMIN or EMPLOYEE');
  if (findOne('Users', function (u) { return String(u.email).toLowerCase() === email; })) {
    throw new AppError_('CONFLICT', 'A user with that email already exists');
  }

  var salt = makeSalt_();
  var user = {
    userId: Utilities.getUuid(),
    name: name,
    email: email,
    passwordHash: hashPassword_(initialPassword, salt),
    passwordSalt: salt,
    role: role,
    status: 'ACTIVE',
    createdAt: nowIso_(),
    lastLoginAt: ''
  };
  appendRow('Users', user);
  invalidateCaches_(['cache_users_list', 'cache_employees_list']);
  return { user: publicUser_(user) };
}

function adminListUsers_() {
  return cachedRead_('cache_users_list', 60, function () {
    return { users: getAllRows('Users').map(publicUser_) };
  });
}

/**
 * Minimal active-employee directory (userId, name only) - available to both
 * roles, unlike admin.listUsers, so an Employee can populate a "transfer to"
 * dropdown without needing access to the full user-management list (which
 * exposes email/status for every account).
 */
function usersListEmployees_() {
  return cachedRead_('cache_employees_list', 120, function () {
    var employees = findRows('Users', function (u) {
      return u.role === 'EMPLOYEE' && u.status === 'ACTIVE';
    }).map(function (u) {
      return { userId: u.userId, name: u.name };
    });
    return { employees: employees };
  });
}

function adminUpdateUser_(auth, payload) {
  var updates = {};
  if (payload.name !== undefined) updates.name = String(payload.name).trim();
  if (payload.role !== undefined) {
    if (['FOUNDER_ADMIN', 'EMPLOYEE'].indexOf(payload.role) === -1) throw new AppError_('VALIDATION_ERROR', 'Invalid role');
    updates.role = payload.role;
  }
  if (payload.status !== undefined) {
    if (['ACTIVE', 'DISABLED'].indexOf(payload.status) === -1) throw new AppError_('VALIDATION_ERROR', 'Invalid status');
    updates.status = payload.status;
  }
  var updated = updateById('Users', 'userId', payload.userId, updates);
  if (!updated) throw new AppError_('NOT_FOUND', 'User not found');
  invalidateUserCache_(payload.userId);
  invalidateCaches_(['cache_users_list', 'cache_employees_list']);
  return { user: publicUser_(updated) };
}

function adminResetUserPassword_(auth, payload) {
  var user = findById('Users', 'userId', payload.userId);
  if (!user) throw new AppError_('NOT_FOUND', 'User not found');
  var newPassword = String(payload.newPassword || '');
  if (newPassword.length < 8) throw new AppError_('VALIDATION_ERROR', 'Password must be at least 8 characters');
  var salt = makeSalt_();
  updateById('Users', 'userId', payload.userId, { passwordSalt: salt, passwordHash: hashPassword_(newPassword, salt) });
  invalidateUserCache_(payload.userId);
  return { ok: true };
}

// =====================================================================
// 5. Config & Holidays - Config sheet is a simple key-value store (key,
// value, unit, updatedAt, updatedBy). Used for the 4 TAT durations,
// session TTL, and the Matter/Task ID sequence counters. Holidays is a
// separate flat list.
// =====================================================================

function getConfigValue_(key) {
  var row = findById('Config', 'key', key);
  return row ? row.value : null;
}

/** Returns {value, unit} for a Config row, or null if not set. */
function getConfigRow_(key) {
  var row = findById('Config', 'key', key);
  return row ? { value: row.value, unit: row.unit } : null;
}

function setConfigValue_(key, value, unit, actorId) {
  var existing = findById('Config', 'key', key);
  var now = nowIso_();
  if (existing) {
    updateById('Config', 'key', key, {
      value: value,
      unit: unit !== undefined ? unit : existing.unit,
      updatedAt: now,
      updatedBy: actorId || 'SYSTEM'
    });
  } else {
    appendRow('Config', { key: key, value: value, unit: unit || '', updatedAt: now, updatedBy: actorId || 'SYSTEM' });
  }
}

var TAT_STEP_TYPES_ = ['STEP1', 'STEP2', 'CLIENT_APPROVAL', 'FILING'];

function adminGetConfig_() {
  return cachedRead_('cache_config_all', 300, function () {
    var rows = getAllRows('Config');
    var map = {};
    rows.forEach(function (r) {
      map[r.key] = { value: r.value, unit: r.unit };
    });
    return { config: map };
  });
}

function adminUpdateTat_(auth, payload) {
  var stepType = payload.stepType;
  if (TAT_STEP_TYPES_.indexOf(stepType) === -1) {
    throw new AppError_('VALIDATION_ERROR', 'stepType must be one of ' + TAT_STEP_TYPES_.join(', '));
  }
  var value = Number(payload.value);
  var unit = payload.unit;
  if (!value || value <= 0) throw new AppError_('VALIDATION_ERROR', 'value must be a positive number');
  if (['DAYS', 'HOURS'].indexOf(unit) === -1) throw new AppError_('VALIDATION_ERROR', 'unit must be DAYS or HOURS');

  setConfigValue_('TAT_' + stepType, String(value), unit, auth.userId);
  invalidateCache_('cache_config_all');
  return adminGetConfig_();
}

function adminListHolidays_() {
  return cachedRead_('cache_holidays_list', 300, function () {
    var rows = getAllRows('Holidays').sort(function (a, b) {
      return String(a.date).localeCompare(String(b.date));
    });
    return { holidays: rows };
  });
}

function adminAddHoliday_(auth, payload) {
  var date = String(payload.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError_('VALIDATION_ERROR', 'date must be in yyyy-mm-dd format');
  var holiday = {
    holidayId: Utilities.getUuid(),
    date: date,
    label: String(payload.label || ''),
    createdAt: nowIso_(),
    createdBy: auth.userId
  };
  appendRow('Holidays', holiday);
  invalidateCaches_(['cache_holidays_list', 'cache_holidays_set']);
  return { holiday: holiday };
}

function adminDeleteHoliday_(auth, payload) {
  var deleted = deleteById_('Holidays', 'holidayId', payload.holidayId);
  if (!deleted) throw new AppError_('NOT_FOUND', 'Holiday not found');
  invalidateCaches_(['cache_holidays_list', 'cache_holidays_set']);
  return { ok: true };
}

/** Set of yyyy-mm-dd date strings, for O(1) holiday lookups by the TAT algorithm. */
function loadHolidaySet_() {
  return cachedRead_('cache_holidays_set', 300, function () {
    var set = {};
    getAllRows('Holidays').forEach(function (r) {
      set[String(r.date)] = true;
    });
    return set;
  });
}

// =====================================================================
// 6. TAT / working-time algorithm. Shared by dueAt computation (when a
// step starts), TAT-breach flagging, and overdue scoring. Weekends and
// any date present in the Holidays sheet are treated as entirely
// non-working.
// =====================================================================

function dateOnlyStr_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function isNonWorkingDay_(date, holidaySet) {
  var dow = date.getDay(); // 0 = Sun, 6 = Sat
  if (dow === 0 || dow === 6) return true;
  return !!holidaySet[dateOnlyStr_(date)];
}

function startOfNextDay_(date) {
  var d = new Date(date.getTime());
  d.setHours(24, 0, 0, 0);
  return d;
}

function endOfDay_(date) {
  var d = new Date(date.getTime());
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Advances `startAt` by `days` whole working days (skips non-working days entirely). */
function addWorkingDays_(startAt, days, holidaySet) {
  var cursor = new Date(startAt.getTime());
  var remaining = days;
  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    if (!isNonWorkingDay_(cursor, holidaySet)) remaining -= 1;
  }
  return cursor;
}

/**
 * Advances `startAt` by `hours` on a 24-hour clock, but entire non-working
 * days are skipped wholesale (jump straight to next day 00:00) rather than
 * counting any of their hours.
 */
function addWorkingHours_(startAt, hours, holidaySet) {
  var cursor = new Date(startAt.getTime());
  var remainingMs = hours * 60 * 60 * 1000;
  while (remainingMs > 0) {
    if (isNonWorkingDay_(cursor, holidaySet)) {
      cursor = startOfNextDay_(cursor);
      continue;
    }
    var msLeftInDay = endOfDay_(cursor).getTime() - cursor.getTime() + 1;
    if (remainingMs <= msLeftInDay) {
      cursor = new Date(cursor.getTime() + remainingMs);
      remainingMs = 0;
    } else {
      remainingMs -= msLeftInDay;
      cursor = startOfNextDay_(cursor);
    }
  }
  return cursor;
}

function computeDueAt_(startAt, tatValue, tatUnit, holidaySet) {
  if (tatUnit === 'DAYS') return addWorkingDays_(startAt, Number(tatValue), holidaySet);
  if (tatUnit === 'HOURS') return addWorkingHours_(startAt, Number(tatValue), holidaySet);
  throw new AppError_('SERVER_ERROR', 'Unknown TAT unit: ' + tatUnit);
}

function isBreached_(dueAt, now) {
  return now.getTime() > dueAt.getTime();
}

/**
 * Counts whole working (non-weekend, non-holiday) calendar days strictly
 * after dueAt's date, up to and including referenceAt's date. Deliberately
 * date-granular regardless of whether the TAT was DAYS- or HOURS-based,
 * per the "+1 point per extra working day late" scoring rule.
 */
function workingDaysLate_(dueAt, referenceAt, holidaySet) {
  if (referenceAt.getTime() <= dueAt.getTime()) return 0;
  var cursor = startOfNextDay_(new Date(dateOnlyStr_(dueAt) + 'T00:00:00'));
  var refDateOnly = new Date(dateOnlyStr_(referenceAt) + 'T00:00:00');
  var count = 0;
  while (cursor.getTime() <= refDateOnly.getTime()) {
    if (!isNonWorkingDay_(cursor, holidaySet)) count += 1;
    cursor = startOfNextDay_(cursor);
  }
  return count;
}

/**
 * Fetches the TAT value/unit configured for a step type and computes the
 * concrete dueAt for a step starting now. Returns {dueAt: Date, tatValue, tatUnit}.
 */
function resolveStepTat_(stepType, startAt, holidaySet) {
  var row = getConfigRow_('TAT_' + stepType);
  var value = row && Number(row.value);
  var unit = row && row.unit;
  if (!value || !unit) {
    throw new AppError_('SERVER_ERROR', 'TAT for ' + stepType + ' is not configured. Set it under Admin > Config.');
  }
  return { dueAt: computeDueAt_(startAt, value, unit, holidaySet), tatValue: value, tatUnit: unit };
}

// =====================================================================
// 7. Matters - FMS state machine, shared by Litigation and
// Non-Litigation matters (identical workflow, distinguished only by
// `type`).
//
// currentStep flow:
//   DRAFTING_STEP1
//     -> DRAFTING_STEP2
//     -> AWAITING_FOUNDER_REVIEW          (completeStep2AndSubmit: iteration 1, unscored)
//     -> REVISING_AFTER_FOUNDER_NOTES     (founderDecision: CHANGES_REQUESTED)
//     -> AWAITING_FOUNDER_REVIEW          (submitToFounder: iteration N, ALWAYS scored)
//     -> READY_FOR_CLIENT_SEND            (founderDecision: APPROVED)
//     -> AWAITING_CLIENT_REVIEW           (sendForClientApproval)
//     -> REVISING_AFTER_CLIENT_CHANGES    (recordClientDecision: CHANGES_REQUESTED)
//     -> AWAITING_FOUNDER_REVIEW          (submitToFounder again - same lifetime counter)
//     -> READY_FOR_FILING                 (recordClientDecision: APPROVED, founder already approved this round)
//     -> AWAITING_FILING_COMPLETION       (sendForFiling)
//     -> COMPLETED                        (completeFiling)
//
// founderIterationCounter is a MATTER-LIFETIME running total -
// completeStep2AndSubmit is the only path that can create iteration 1
// (never scored); submitToFounder is the only path for every later
// iteration (always scored), whether triggered by founder notes or by
// client-requested changes.
// =====================================================================

var TAT_STEP_TYPE_FOR_CONFIG_ = {
  STEP1_DATES_NOTES: 'STEP1',
  STEP2_BRIEF: 'STEP2',
  CLIENT_APPROVAL_SEND: 'CLIENT_APPROVAL',
  FILING: 'FILING'
};

function requireOwnedMatter_(auth, matterId) {
  var matter = findById('Matters', 'matterId', matterId);
  if (!matter) throw new AppError_('NOT_FOUND', 'Matter not found');
  if (matter.employeeId !== auth.userId) throw new AppError_('FORBIDDEN', 'You are not the current owner of this matter');
  return matter;
}

function requireAnyMatter_(matterId) {
  var matter = findById('Matters', 'matterId', matterId);
  if (!matter) throw new AppError_('NOT_FOUND', 'Matter not found');
  return matter;
}

function startMatterStep_(matter, stepType, clientRoundNumber) {
  var holidaySet = loadHolidaySet_();
  var now = new Date();
  var configStepType = TAT_STEP_TYPE_FOR_CONFIG_[stepType];
  var tat = resolveStepTat_(configStepType, now, holidaySet);
  var step = {
    stepInstanceId: Utilities.getUuid(),
    matterId: matter.matterId,
    stepType: stepType,
    clientRoundNumber: clientRoundNumber,
    tatValue: tat.tatValue,
    tatUnit: tat.tatUnit,
    startedAt: now.toISOString(),
    dueAt: tat.dueAt.toISOString(),
    completedAt: '',
    status: 'IN_PROGRESS',
    assignedEmployeeId: matter.employeeId,
    createdAt: now.toISOString()
  };
  appendRow('MatterSteps', step);
  return step;
}

/** Marks the given step DONE/BREACHED_DONE and true-ups any overdue scoring for it. */
function completeMatterStep_(step) {
  var now = new Date();
  scoreOverdueForRef_(
    'MATTER_STEP',
    step.stepInstanceId,
    step.assignedEmployeeId,
    step.dueAt,
    now,
    'OVERDUE_STEP',
    'Step ' + step.stepType + ' on ' + step.matterId + ' overdue'
  );
  var breached = step.dueAt && now.getTime() > new Date(step.dueAt).getTime();
  return updateById('MatterSteps', 'stepInstanceId', step.stepInstanceId, {
    completedAt: now.toISOString(),
    status: breached ? 'BREACHED_DONE' : 'DONE'
  });
}

function findOpenStep_(matterId, stepType) {
  return findOne('MatterSteps', function (s) {
    return s.matterId === matterId && s.stepType === stepType && (s.status === 'IN_PROGRESS' || s.status === 'PENDING' || s.status === 'BREACHED_OPEN');
  });
}

// ---- Matters CRUD ----

function mattersCreate_(auth, payload) {
  var type = payload.type;
  if (['LITIGATION', 'NON_LITIGATION'].indexOf(type) === -1) throw new AppError_('VALIDATION_ERROR', 'type must be LITIGATION or NON_LITIGATION');
  var title = String(payload.title || '').trim();
  if (!title) throw new AppError_('VALIDATION_ERROR', 'title is required');
  var employee = findById('Users', 'userId', payload.employeeId);
  if (!employee || employee.role !== 'EMPLOYEE' || employee.status !== 'ACTIVE') {
    throw new AppError_('VALIDATION_ERROR', 'employeeId must reference an active Employee');
  }

  var now = nowIso_();
  var matter = {
    matterId: nextId_('MATTER'),
    type: type,
    title: title,
    clientName: String(payload.clientName || '').trim(),
    employeeId: employee.userId,
    founderId: auth.userId,
    currentStep: 'DRAFTING_STEP1',
    status: 'IN_PROGRESS',
    founderApprovedInCurrentRound: false,
    clientApprovedInCurrentRound: false,
    founderIterationCounter: 0,
    clientRoundCounter: 0,
    createdAt: now,
    createdBy: auth.userId,
    updatedAt: now
  };
  appendRow('Matters', matter);
  var step = startMatterStep_(matter, 'STEP1_DATES_NOTES', 1);
  return { matter: matter, step: step };
}

function mattersList_(auth, payload) {
  var rows = getAllRows('Matters');
  if (auth.role === 'EMPLOYEE') {
    rows = rows.filter(function (m) {
      return m.employeeId === auth.userId;
    });
  } else if (payload.employeeId) {
    rows = rows.filter(function (m) {
      return m.employeeId === payload.employeeId;
    });
  }
  if (payload.status) rows = rows.filter(function (m) { return m.status === payload.status; });
  if (payload.type) rows = rows.filter(function (m) { return m.type === payload.type; });
  return { matters: rows };
}

function mattersGet_(auth, payload) {
  var matter = requireAnyMatter_(payload.matterId);
  if (auth.role === 'EMPLOYEE' && matter.employeeId !== auth.userId) {
    throw new AppError_('FORBIDDEN', 'You are not the owner of this matter');
  }
  var steps = findRows('MatterSteps', function (s) { return s.matterId === matter.matterId; });
  var approvalCycles = findRows('ApprovalCycles', function (c) { return c.matterId === matter.matterId; });
  var transferRequests = findRows('TransferRequests', function (t) { return t.matterId === matter.matterId; });
  return { matter: matter, steps: steps, approvalCycles: approvalCycles, transferRequests: transferRequests };
}

// ---- Step 1 / Step 2 ----

function mattersCompleteStep1_(auth, payload) {
  var matter = requireOwnedMatter_(auth, payload.matterId);
  if (matter.currentStep !== 'DRAFTING_STEP1') throw new AppError_('CONFLICT', 'Matter is not in Step 1');

  var step = findOpenStep_(matter.matterId, 'STEP1_DATES_NOTES');
  if (step) completeMatterStep_(step);

  var updated = updateById('Matters', 'matterId', matter.matterId, { currentStep: 'DRAFTING_STEP2', updatedAt: nowIso_() });
  var nextStep = startMatterStep_(updated, 'STEP2_BRIEF', 1);
  return { matter: updated, step: nextStep };
}

function mattersCompleteStep2AndSubmit_(auth, payload) {
  var matter = requireOwnedMatter_(auth, payload.matterId);
  if (matter.currentStep !== 'DRAFTING_STEP2') throw new AppError_('CONFLICT', 'Matter is not in Step 2');

  var step = findOpenStep_(matter.matterId, 'STEP2_BRIEF');
  if (step) completeMatterStep_(step);

  var now = nowIso_();
  var cycle = {
    cycleId: Utilities.getUuid(),
    matterId: matter.matterId,
    cycleType: 'FOUNDER_REVIEW',
    clientRoundNumber: 1,
    founderIterationNumber: 1,
    submittedAt: now,
    submittedBy: auth.userId,
    decision: 'PENDING',
    decisionNotes: String(payload.notes || ''),
    decidedAt: '',
    decidedBy: '',
    scoredPoint: false,
    createdAt: now
  };
  appendRow('ApprovalCycles', cycle);

  var updated = updateById('Matters', 'matterId', matter.matterId, {
    currentStep: 'AWAITING_FOUNDER_REVIEW',
    founderIterationCounter: 1,
    founderApprovedInCurrentRound: false,
    updatedAt: now
  });
  return { matter: updated, cycle: cycle };
}

// ---- Founder review ----

function mattersFounderDecision_(auth, payload) {
  var matter = requireAnyMatter_(payload.matterId);
  if (matter.currentStep !== 'AWAITING_FOUNDER_REVIEW') throw new AppError_('CONFLICT', 'Matter is not awaiting founder review');

  var cycle = findById('ApprovalCycles', 'cycleId', payload.cycleId);
  if (!cycle || cycle.matterId !== matter.matterId || cycle.cycleType !== 'FOUNDER_REVIEW' || cycle.decision !== 'PENDING') {
    throw new AppError_('CONFLICT', 'No pending founder-review cycle matches this request');
  }

  var decision = payload.decision;
  if (['APPROVED', 'CHANGES_REQUESTED'].indexOf(decision) === -1) throw new AppError_('VALIDATION_ERROR', 'decision must be APPROVED or CHANGES_REQUESTED');
  var notes = String(payload.notes || '').trim();
  if (decision === 'CHANGES_REQUESTED' && !notes) {
    throw new AppError_('VALIDATION_ERROR', 'notes are required when requesting changes - explain what needs to change');
  }

  var now = nowIso_();
  var updatedCycle = updateById('ApprovalCycles', 'cycleId', cycle.cycleId, {
    decision: decision,
    decisionNotes: notes,
    decidedAt: now,
    decidedBy: auth.userId
  });

  var matterUpdates = { updatedAt: now };
  if (decision === 'APPROVED') {
    matterUpdates.founderApprovedInCurrentRound = true;
    matterUpdates.currentStep = 'READY_FOR_CLIENT_SEND';
  } else {
    matterUpdates.founderApprovedInCurrentRound = false;
    matterUpdates.currentStep = 'REVISING_AFTER_FOUNDER_NOTES';
  }
  var updatedMatter = updateById('Matters', 'matterId', matter.matterId, matterUpdates);

  return { matter: updatedMatter, cycle: updatedCycle };
}

// ---- Client review ----

function mattersSendForClientApproval_(auth, payload) {
  var matter = requireOwnedMatter_(auth, payload.matterId);
  if (matter.currentStep !== 'READY_FOR_CLIENT_SEND') throw new AppError_('CONFLICT', 'Matter is not ready to send for client approval');

  var newRoundNumber = Number(matter.clientRoundCounter || 0) + 1;
  var now = nowIso_();
  var updatedMatter = updateById('Matters', 'matterId', matter.matterId, {
    clientRoundCounter: newRoundNumber,
    clientApprovedInCurrentRound: false,
    currentStep: 'AWAITING_CLIENT_REVIEW',
    updatedAt: now
  });

  var step = startMatterStep_(updatedMatter, 'CLIENT_APPROVAL_SEND', newRoundNumber);

  var cycle = {
    cycleId: Utilities.getUuid(),
    matterId: matter.matterId,
    cycleType: 'CLIENT_REVIEW',
    clientRoundNumber: newRoundNumber,
    founderIterationNumber: '',
    submittedAt: now,
    submittedBy: auth.userId,
    decision: 'PENDING',
    decisionNotes: '',
    decidedAt: '',
    decidedBy: '',
    scoredPoint: false,
    createdAt: now
  };
  appendRow('ApprovalCycles', cycle);

  return { matter: updatedMatter, step: step, cycle: cycle };
}

function mattersRecordClientDecision_(auth, payload) {
  var matter = requireOwnedMatter_(auth, payload.matterId);
  if (matter.currentStep !== 'AWAITING_CLIENT_REVIEW') throw new AppError_('CONFLICT', 'Matter is not awaiting client review');

  var cycle = findById('ApprovalCycles', 'cycleId', payload.cycleId);
  if (!cycle || cycle.matterId !== matter.matterId || cycle.cycleType !== 'CLIENT_REVIEW' || cycle.decision !== 'PENDING') {
    throw new AppError_('CONFLICT', 'No pending client-review cycle matches this request');
  }

  var decision = payload.decision;
  if (['APPROVED', 'CHANGES_REQUESTED'].indexOf(decision) === -1) throw new AppError_('VALIDATION_ERROR', 'decision must be APPROVED or CHANGES_REQUESTED');
  var notes = String(payload.notes || '').trim();
  if (decision === 'CHANGES_REQUESTED' && !notes) {
    throw new AppError_('VALIDATION_ERROR', 'notes are required when requesting changes - explain what the client wants changed');
  }

  var step = findOpenStep_(matter.matterId, 'CLIENT_APPROVAL_SEND');
  if (step) completeMatterStep_(step);

  var now = nowIso_();
  var updatedCycle = updateById('ApprovalCycles', 'cycleId', cycle.cycleId, {
    decision: decision,
    decisionNotes: notes,
    decidedAt: now,
    decidedBy: auth.userId
  });

  var matterUpdates = { updatedAt: now };
  if (decision === 'APPROVED') {
    if (!matter.founderApprovedInCurrentRound) {
      // Should not be reachable given the state machine, but guard against
      // inconsistent state rather than silently advancing to filing.
      throw new AppError_('CONFLICT', 'Founder approval for this round is missing; cannot proceed to filing');
    }
    matterUpdates.clientApprovedInCurrentRound = true;
    matterUpdates.currentStep = 'READY_FOR_FILING';
  } else {
    matterUpdates.clientApprovedInCurrentRound = false;
    matterUpdates.currentStep = 'REVISING_AFTER_CLIENT_CHANGES';
  }
  var updatedMatter = updateById('Matters', 'matterId', matter.matterId, matterUpdates);

  return { matter: updatedMatter, cycle: updatedCycle };
}

// ---- Resubmission to founder (iteration >= 2, always scored) ----

function mattersSubmitToFounder_(auth, payload) {
  var matter = requireOwnedMatter_(auth, payload.matterId);
  if (['REVISING_AFTER_FOUNDER_NOTES', 'REVISING_AFTER_CLIENT_CHANGES'].indexOf(matter.currentStep) === -1) {
    throw new AppError_('CONFLICT', 'Matter is not in a revision state that can be resubmitted to the founder');
  }

  var newIteration = Number(matter.founderIterationCounter || 1) + 1;
  var now = nowIso_();
  var cycle = {
    cycleId: Utilities.getUuid(),
    matterId: matter.matterId,
    cycleType: 'FOUNDER_REVIEW',
    clientRoundNumber: matter.clientRoundCounter || 1,
    founderIterationNumber: newIteration,
    submittedAt: now,
    submittedBy: auth.userId,
    decision: 'PENDING',
    decisionNotes: String(payload.notes || ''),
    decidedAt: '',
    decidedBy: '',
    scoredPoint: true,
    createdAt: now
  };
  appendRow('ApprovalCycles', cycle);

  appendRow('ScoreLedger', {
    ledgerId: Utilities.getUuid(),
    employeeId: matter.employeeId,
    eventType: 'FOUNDER_RESUBMISSION',
    points: 1,
    refType: 'MATTER_APPROVAL',
    refId: cycle.cycleId,
    relatedWorkingDate: '',
    description: 'Resubmission #' + newIteration + ' to Founder on ' + matter.matterId,
    createdAt: now,
    createdBy: 'SYSTEM'
  });

  var updatedMatter = updateById('Matters', 'matterId', matter.matterId, {
    currentStep: 'AWAITING_FOUNDER_REVIEW',
    founderApprovedInCurrentRound: false,
    founderIterationCounter: newIteration,
    updatedAt: now
  });

  return { matter: updatedMatter, cycle: cycle };
}

// ---- Filing ----

function mattersSendForFiling_(auth, payload) {
  var matter = requireOwnedMatter_(auth, payload.matterId);
  if (matter.currentStep !== 'READY_FOR_FILING') throw new AppError_('CONFLICT', 'Matter is not ready for filing');

  var updatedMatter = updateById('Matters', 'matterId', matter.matterId, {
    currentStep: 'AWAITING_FILING_COMPLETION',
    updatedAt: nowIso_()
  });
  var step = startMatterStep_(updatedMatter, 'FILING', matter.clientRoundCounter || 1);
  return { matter: updatedMatter, step: step };
}

function mattersCompleteFiling_(auth, payload) {
  var matter = requireOwnedMatter_(auth, payload.matterId);
  if (matter.currentStep !== 'AWAITING_FILING_COMPLETION') throw new AppError_('CONFLICT', 'Matter is not awaiting filing completion');

  var step = findOpenStep_(matter.matterId, 'FILING');
  if (step) completeMatterStep_(step);

  var updatedMatter = updateById('Matters', 'matterId', matter.matterId, {
    currentStep: 'COMPLETED',
    status: 'COMPLETED',
    updatedAt: nowIso_()
  });
  return { matter: updatedMatter };
}

// ---- Transfers ----

function mattersRequestTransfer_(auth, payload) {
  var matter = requireOwnedMatter_(auth, payload.matterId);
  if (matter.status !== 'IN_PROGRESS') throw new AppError_('CONFLICT', 'Matter is not in progress');

  var toEmployee = findById('Users', 'userId', payload.toEmployeeId);
  if (!toEmployee || toEmployee.role !== 'EMPLOYEE' || toEmployee.status !== 'ACTIVE') {
    throw new AppError_('VALIDATION_ERROR', 'toEmployeeId must reference an active Employee');
  }
  if (toEmployee.userId === matter.employeeId) throw new AppError_('VALIDATION_ERROR', 'Matter is already owned by that employee');

  var existingPending = findOne('TransferRequests', function (t) {
    return t.matterId === matter.matterId && t.status === 'PENDING';
  });
  if (existingPending) throw new AppError_('CONFLICT', 'A transfer request is already pending for this matter');

  var reason = String(payload.reason || '').trim();
  if (!reason) throw new AppError_('VALIDATION_ERROR', 'reason is required');

  var transferRequest = {
    transferRequestId: Utilities.getUuid(),
    matterId: matter.matterId,
    fromEmployeeId: matter.employeeId,
    toEmployeeId: toEmployee.userId,
    reason: reason,
    requestedBy: auth.userId,
    requestedAt: nowIso_(),
    status: 'PENDING',
    decidedBy: '',
    decidedAt: '',
    decisionNotes: ''
  };
  appendRow('TransferRequests', transferRequest);
  return { transferRequest: transferRequest };
}

function mattersListTransferRequests_(auth, payload) {
  var rows = getAllRows('TransferRequests');
  if (auth.role === 'EMPLOYEE') {
    rows = rows.filter(function (t) { return t.fromEmployeeId === auth.userId || t.toEmployeeId === auth.userId; });
  }
  if (payload.status) rows = rows.filter(function (t) { return t.status === payload.status; });
  return { transferRequests: rows };
}

function mattersDecideTransfer_(auth, payload) {
  var tr = findById('TransferRequests', 'transferRequestId', payload.transferRequestId);
  if (!tr || tr.status !== 'PENDING') throw new AppError_('CONFLICT', 'Transfer request is not pending');

  var decision = payload.decision;
  if (['APPROVED', 'REJECTED'].indexOf(decision) === -1) throw new AppError_('VALIDATION_ERROR', 'decision must be APPROVED or REJECTED');

  var now = nowIso_();
  var updatedTr = updateById('TransferRequests', 'transferRequestId', tr.transferRequestId, {
    status: decision,
    decidedBy: auth.userId,
    decidedAt: now,
    decisionNotes: String(payload.notes || '')
  });

  var matter = findById('Matters', 'matterId', tr.matterId);
  if (decision === 'APPROVED') {
    matter = updateById('Matters', 'matterId', tr.matterId, { employeeId: tr.toEmployeeId, updatedAt: now });
    var openStep = findOne('MatterSteps', function (s) {
      return s.matterId === tr.matterId && (s.status === 'IN_PROGRESS' || s.status === 'PENDING' || s.status === 'BREACHED_OPEN');
    });
    if (openStep) {
      updateById('MatterSteps', 'stepInstanceId', openStep.stepInstanceId, { assignedEmployeeId: tr.toEmployeeId });
    }
  }

  return { transferRequest: updatedTr, matter: matter };
}

// =====================================================================
// 8. Court punches - standalone per-employee log, not linked to any matter.
// =====================================================================

function courtPunchIn_(auth, payload) {
  var open = findOne('CourtPunches', function (p) {
    return p.employeeId === auth.userId && !p.punchOutAt;
  });
  if (open) throw new AppError_('CONFLICT', 'You already have an open court punch-in');

  var punch = {
    punchId: Utilities.getUuid(),
    employeeId: auth.userId,
    punchInAt: nowIso_(),
    punchOutAt: '',
    courtName: String(payload.courtName || ''),
    note: String(payload.note || ''),
    createdAt: nowIso_()
  };
  appendRow('CourtPunches', punch);
  return { punch: punch };
}

function courtPunchOut_(auth, payload) {
  var punch = findById('CourtPunches', 'punchId', payload.punchId);
  if (!punch || punch.employeeId !== auth.userId) throw new AppError_('NOT_FOUND', 'Punch not found');
  if (punch.punchOutAt) throw new AppError_('CONFLICT', 'This punch has already been closed');

  var updated = updateById('CourtPunches', 'punchId', payload.punchId, { punchOutAt: nowIso_() });
  return { punch: updated };
}

function courtMyPunches_(auth, payload) {
  var rows = findRows('CourtPunches', function (p) { return p.employeeId === auth.userId; });
  rows = filterByDateRange_(rows, 'punchInAt', payload.fromDate, payload.toDate);
  return { punches: rows };
}

function courtListAll_(auth, payload) {
  var rows = getAllRows('CourtPunches');
  if (payload.employeeId) rows = rows.filter(function (p) { return p.employeeId === payload.employeeId; });
  rows = filterByDateRange_(rows, 'punchInAt', payload.fromDate, payload.toDate);
  return { punches: rows };
}

// =====================================================================
// 9. Independent tasks - Admin assigns title/description/priority/due
// date to an Employee. Admin can push the due date freely; an Employee
// push requires Admin approval + a reason.
// =====================================================================

function tasksCreate_(auth, payload) {
  var employee = findById('Users', 'userId', payload.employeeId);
  if (!employee || employee.role !== 'EMPLOYEE' || employee.status !== 'ACTIVE') {
    throw new AppError_('VALIDATION_ERROR', 'employeeId must reference an active Employee');
  }
  var title = String(payload.title || '').trim();
  if (!title) throw new AppError_('VALIDATION_ERROR', 'title is required');
  var dueAt = String(payload.dueAt || '');
  if (!dueAt) throw new AppError_('VALIDATION_ERROR', 'dueAt is required');
  var priority = payload.priority;
  if (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].indexOf(priority) === -1) throw new AppError_('VALIDATION_ERROR', 'Invalid priority');

  var now = nowIso_();
  var task = {
    taskId: nextId_('TASK'),
    title: title,
    description: String(payload.description || ''),
    assignedTo: employee.userId,
    assignedBy: auth.userId,
    priority: priority,
    dueAt: dueAt,
    originalDueAt: dueAt,
    status: 'OPEN',
    completedAt: '',
    createdAt: now,
    updatedAt: now
  };
  appendRow('IndependentTasks', task);
  return { task: task };
}

function tasksList_(auth, payload) {
  var rows = getAllRows('IndependentTasks');
  if (auth.role === 'EMPLOYEE') {
    rows = rows.filter(function (t) { return t.assignedTo === auth.userId; });
  } else if (payload.employeeId) {
    rows = rows.filter(function (t) { return t.assignedTo === payload.employeeId; });
  }
  if (payload.status) rows = rows.filter(function (t) { return t.status === payload.status; });
  return { tasks: rows };
}

function tasksGet_(auth, payload) {
  var task = findById('IndependentTasks', 'taskId', payload.taskId);
  if (!task) throw new AppError_('NOT_FOUND', 'Task not found');
  if (auth.role === 'EMPLOYEE' && task.assignedTo !== auth.userId) throw new AppError_('FORBIDDEN', 'Not your task');
  var pushRequests = findRows('TaskPushRequests', function (r) { return r.taskId === task.taskId; });
  return { task: task, pushRequests: pushRequests };
}

function tasksUpdateStatus_(auth, payload) {
  var task = findById('IndependentTasks', 'taskId', payload.taskId);
  if (!task) throw new AppError_('NOT_FOUND', 'Task not found');

  var status = payload.status;
  var validStatuses = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
  if (validStatuses.indexOf(status) === -1) throw new AppError_('VALIDATION_ERROR', 'Invalid status');

  if (auth.role === 'EMPLOYEE') {
    if (task.assignedTo !== auth.userId) throw new AppError_('FORBIDDEN', 'Not your task');
    if (status === 'CANCELLED') throw new AppError_('FORBIDDEN', 'Employees cannot cancel tasks');
  }

  var updates = { status: status, updatedAt: nowIso_() };
  if (status === 'DONE' && task.status !== 'DONE') {
    scoreOverdueForRef_('TASK', task.taskId, task.assignedTo, task.dueAt, new Date(), 'OVERDUE_TASK', 'Task ' + task.taskId + ' (' + task.title + ') overdue');
    updates.completedAt = nowIso_();
  }
  var updated = updateById('IndependentTasks', 'taskId', payload.taskId, updates);
  return { task: updated };
}

function tasksAdminPushDueDate_(auth, payload) {
  var task = findById('IndependentTasks', 'taskId', payload.taskId);
  if (!task) throw new AppError_('NOT_FOUND', 'Task not found');
  var newDueAt = String(payload.newDueAt || '');
  if (!newDueAt) throw new AppError_('VALIDATION_ERROR', 'newDueAt is required');

  var now = nowIso_();
  var pushRequest = {
    pushRequestId: Utilities.getUuid(),
    taskId: task.taskId,
    requestedBy: '',
    initiatedByRole: 'ADMIN',
    currentDueAt: task.dueAt,
    requestedDueAt: newDueAt,
    reason: String(payload.notes || ''),
    status: 'AUTO_APPROVED',
    requestedAt: now,
    decidedBy: auth.userId,
    decidedAt: now,
    decisionNotes: ''
  };
  appendRow('TaskPushRequests', pushRequest);
  var updated = updateById('IndependentTasks', 'taskId', task.taskId, { dueAt: newDueAt, updatedAt: now });
  return { task: updated, pushRequest: pushRequest };
}

function tasksRequestPushDueDate_(auth, payload) {
  var task = findById('IndependentTasks', 'taskId', payload.taskId);
  if (!task || task.assignedTo !== auth.userId) throw new AppError_('FORBIDDEN', 'Not your task');

  var reason = String(payload.reason || '').trim();
  if (!reason) throw new AppError_('VALIDATION_ERROR', 'reason is required when an employee requests a due-date push');
  var requestedDueAt = String(payload.requestedDueAt || '');
  if (!requestedDueAt) throw new AppError_('VALIDATION_ERROR', 'requestedDueAt is required');

  var existingPending = findOne('TaskPushRequests', function (r) {
    return r.taskId === task.taskId && r.status === 'PENDING';
  });
  if (existingPending) throw new AppError_('CONFLICT', 'A push request is already pending for this task');

  var pushRequest = {
    pushRequestId: Utilities.getUuid(),
    taskId: task.taskId,
    requestedBy: auth.userId,
    initiatedByRole: 'EMPLOYEE',
    currentDueAt: task.dueAt,
    requestedDueAt: requestedDueAt,
    reason: reason,
    status: 'PENDING',
    requestedAt: nowIso_(),
    decidedBy: '',
    decidedAt: '',
    decisionNotes: ''
  };
  appendRow('TaskPushRequests', pushRequest);
  return { pushRequest: pushRequest };
}

function tasksListPushRequests_(auth, payload) {
  var rows = getAllRows('TaskPushRequests');
  if (auth.role === 'EMPLOYEE') rows = rows.filter(function (r) { return r.requestedBy === auth.userId; });
  if (payload.status) rows = rows.filter(function (r) { return r.status === payload.status; });
  return { pushRequests: rows };
}

function tasksDecidePushRequest_(auth, payload) {
  var pr = findById('TaskPushRequests', 'pushRequestId', payload.pushRequestId);
  if (!pr || pr.status !== 'PENDING') throw new AppError_('CONFLICT', 'Push request is not pending');

  var decision = payload.decision;
  if (['APPROVED', 'REJECTED'].indexOf(decision) === -1) throw new AppError_('VALIDATION_ERROR', 'decision must be APPROVED or REJECTED');

  var now = nowIso_();
  var updatedPr = updateById('TaskPushRequests', 'pushRequestId', pr.pushRequestId, {
    status: decision,
    decidedBy: auth.userId,
    decidedAt: now,
    decisionNotes: String(payload.notes || '')
  });

  var task = findById('IndependentTasks', 'taskId', pr.taskId);
  if (decision === 'APPROVED') {
    task = updateById('IndependentTasks', 'taskId', pr.taskId, { dueAt: pr.requestedDueAt, updatedAt: now });
  }

  return { pushRequest: updatedPr, task: task };
}

// =====================================================================
// 10. Scoring - auto-scoring. ScoreLedger is append-only; totals are
// always aggregated on read, never stored redundantly.
//
//  - FOUNDER_RESUBMISSION rows are written directly by
//    mattersSubmitToFounder_ at the moment of resubmission.
//  - OVERDUE_STEP / OVERDUE_TASK rows are written by scoreOverdueForRef_,
//    called both (a) at the moment a step/task is completed late, to
//    true-up the final count, and (b) by the daily scheduledOverdueScan
//    trigger for items that are still open and overdue. Both call sites
//    compute "how many working days late as of right now" and only add
//    the delta beyond what's already on the ledger for that ref, which
//    makes the whole thing idempotent and makes a later due-date push
//    leave already-awarded points untouched (see workingDaysLate_ above).
// =====================================================================

function scoreOverdueForRef_(refType, refId, employeeId, dueAtStr, referenceAt, eventType, description) {
  if (!dueAtStr) return 0;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var holidaySet = loadHolidaySet_();
    var dueAt = new Date(dueAtStr);
    if (referenceAt.getTime() <= dueAt.getTime()) return 0;

    var newTotal = workingDaysLate_(dueAt, referenceAt, holidaySet);
    var already = findRows('ScoreLedger', function (l) {
      return l.refType === refType && l.refId === refId && l.eventType === eventType;
    }).length;
    var delta = Math.max(0, newTotal - already);

    for (var i = 0; i < delta; i++) {
      appendRow('ScoreLedger', {
        ledgerId: Utilities.getUuid(),
        employeeId: employeeId,
        eventType: eventType,
        points: 1,
        refType: refType,
        refId: refId,
        relatedWorkingDate: '',
        description: description,
        createdAt: nowIso_(),
        createdBy: 'SYSTEM'
      });
    }
    return delta;
  } finally {
    lock.releaseLock();
  }
}

/** Daily time-driven trigger target: scans every still-open step/task past its dueAt. */
function scheduledOverdueScan() {
  return runOverdueScan_();
}

function runOverdueScan_() {
  var now = new Date();
  var added = 0;

  var openStepStatuses = { PENDING: true, IN_PROGRESS: true, BREACHED_OPEN: true };
  findRows('MatterSteps', function (s) { return openStepStatuses[s.status]; }).forEach(function (step) {
    added += scoreOverdueForRef_(
      'MATTER_STEP',
      step.stepInstanceId,
      step.assignedEmployeeId,
      step.dueAt,
      now,
      'OVERDUE_STEP',
      'Step ' + step.stepType + ' on ' + step.matterId + ' overdue'
    );
    if (step.dueAt && now.getTime() > new Date(step.dueAt).getTime() && step.status !== 'BREACHED_OPEN') {
      updateById('MatterSteps', 'stepInstanceId', step.stepInstanceId, { status: 'BREACHED_OPEN' });
    }
  });

  var openTaskStatuses = { OPEN: true, IN_PROGRESS: true };
  findRows('IndependentTasks', function (t) { return openTaskStatuses[t.status]; }).forEach(function (task) {
    added += scoreOverdueForRef_(
      'TASK',
      task.taskId,
      task.assignedTo,
      task.dueAt,
      now,
      'OVERDUE_TASK',
      'Task ' + task.taskId + ' (' + task.title + ') overdue'
    );
  });

  return added;
}

function scoringGetLedger_(auth, payload) {
  var employeeId = payload.employeeId;
  if (auth.role === 'EMPLOYEE') employeeId = auth.userId;

  var rows = getAllRows('ScoreLedger');
  if (employeeId) rows = rows.filter(function (r) { return r.employeeId === employeeId; });
  rows = filterByDateRange_(rows, 'createdAt', payload.fromDate, payload.toDate);
  return { entries: rows };
}

function scoringGetSummary_(auth, payload) {
  var rows = filterByDateRange_(getAllRows('ScoreLedger'), 'createdAt', payload.fromDate, payload.toDate);
  var employees = getAllRows('Users').filter(function (u) { return u.role === 'EMPLOYEE'; });

  var summary = employees.map(function (u) {
    var entries = rows.filter(function (r) { return r.employeeId === u.userId; });
    var byType = {};
    var total = 0;
    entries.forEach(function (e) {
      var pts = Number(e.points) || 0;
      byType[e.eventType] = (byType[e.eventType] || 0) + pts;
      total += pts;
    });
    return { employeeId: u.userId, name: u.name, totalPoints: total, byType: byType };
  });
  summary.sort(function (a, b) { return b.totalPoints - a.totalPoints; });
  return { summary: summary };
}

function scoringRecomputeOverdueNow_() {
  return { added: runOverdueScan_() };
}

// =====================================================================
// 11. Dashboards - aggregation convenience endpoints for the frontend.
// =====================================================================

function dashboardAdmin_() {
  var matters = getAllRows('Matters');
  var mattersByStatus = {};
  matters.forEach(function (m) {
    mattersByStatus[m.status] = (mattersByStatus[m.status] || 0) + 1;
  });

  var pendingFounderDecisions = findRows('ApprovalCycles', function (c) {
    return c.cycleType === 'FOUNDER_REVIEW' && c.decision === 'PENDING';
  });
  var pendingTransfers = findRows('TransferRequests', function (t) { return t.status === 'PENDING'; });
  var pendingTaskPushes = findRows('TaskPushRequests', function (p) { return p.status === 'PENDING'; });

  var now = new Date();
  var overdueSteps = findRows('MatterSteps', function (s) {
    return ['PENDING', 'IN_PROGRESS', 'BREACHED_OPEN'].indexOf(s.status) !== -1 && s.dueAt && new Date(s.dueAt).getTime() < now.getTime();
  });
  var overdueTasks = findRows('IndependentTasks', function (t) {
    return ['OPEN', 'IN_PROGRESS'].indexOf(t.status) !== -1 && t.dueAt && new Date(t.dueAt).getTime() < now.getTime();
  });

  return {
    mattersByStatus: mattersByStatus,
    pendingFounderDecisions: pendingFounderDecisions,
    pendingTransfers: pendingTransfers,
    pendingTaskPushes: pendingTaskPushes,
    overdueSteps: overdueSteps,
    overdueTasks: overdueTasks
  };
}

var EMPLOYEE_ACTIONABLE_STEPS_ = {
  DRAFTING_STEP1: true,
  DRAFTING_STEP2: true,
  REVISING_AFTER_FOUNDER_NOTES: true,
  READY_FOR_CLIENT_SEND: true,
  AWAITING_CLIENT_REVIEW: true,
  REVISING_AFTER_CLIENT_CHANGES: true,
  READY_FOR_FILING: true,
  AWAITING_FILING_COMPLETION: true
};

function dashboardEmployee_(auth) {
  var myMatters = findRows('Matters', function (m) {
    return m.employeeId === auth.userId && m.status !== 'COMPLETED' && m.status !== 'CANCELLED';
  });
  var myMattersNeedingAction = myMatters.filter(function (m) {
    return EMPLOYEE_ACTIONABLE_STEPS_[m.currentStep];
  });

  var myOpenTasks = findRows('IndependentTasks', function (t) {
    return t.assignedTo === auth.userId && ['OPEN', 'IN_PROGRESS'].indexOf(t.status) !== -1;
  });
  var myTransferRequests = findRows('TransferRequests', function (t) {
    return t.fromEmployeeId === auth.userId && t.status === 'PENDING';
  });
  var myPushRequests = findRows('TaskPushRequests', function (p) {
    return p.requestedBy === auth.userId && p.status === 'PENDING';
  });

  var now = new Date();
  var myOverdueSteps = findRows('MatterSteps', function (s) {
    return (
      s.assignedEmployeeId === auth.userId &&
      ['PENDING', 'IN_PROGRESS', 'BREACHED_OPEN'].indexOf(s.status) !== -1 &&
      s.dueAt &&
      new Date(s.dueAt).getTime() < now.getTime()
    );
  });
  var myOverdueTasks = myOpenTasks.filter(function (t) {
    return t.dueAt && new Date(t.dueAt).getTime() < now.getTime();
  });

  var myOpenCourtPunch = findOne('CourtPunches', function (p) { return p.employeeId === auth.userId && !p.punchOutAt; });

  return {
    myMattersNeedingAction: myMattersNeedingAction,
    myOpenTasks: myOpenTasks,
    myPendingRequests: { transfers: myTransferRequests, taskPushes: myPushRequests },
    myOverdueItems: { steps: myOverdueSteps, tasks: myOverdueTasks },
    myOpenCourtPunch: myOpenCourtPunch
  };
}

// =====================================================================
// 12. Router - ACTIONS_ dispatch table + doGet/doPost entry points.
// =====================================================================

var ACTIONS_ = {
  'auth.login': { public: true, fn: function (auth, payload) { return login_(payload); } },
  'auth.logout': { roles: ['FOUNDER_ADMIN', 'EMPLOYEE'], fn: function (auth) { return logout_(auth); } },
  'auth.me': { roles: ['FOUNDER_ADMIN', 'EMPLOYEE'], fn: function (auth) { return { user: publicUser_(getUserCached_(auth.userId)) }; } },
  'auth.changePassword': { roles: ['FOUNDER_ADMIN', 'EMPLOYEE'], fn: changePassword_ },

  'admin.createUser': { roles: ['FOUNDER_ADMIN'], fn: adminCreateUser_ },
  'admin.listUsers': { roles: ['FOUNDER_ADMIN'], fn: adminListUsers_ },
  'users.listEmployees': { roles: ['FOUNDER_ADMIN', 'EMPLOYEE'], fn: usersListEmployees_ },
  'admin.updateUser': { roles: ['FOUNDER_ADMIN'], fn: adminUpdateUser_ },
  'admin.resetUserPassword': { roles: ['FOUNDER_ADMIN'], fn: adminResetUserPassword_ },
  'admin.getConfig': { roles: ['FOUNDER_ADMIN', 'EMPLOYEE'], fn: adminGetConfig_ },
  'admin.updateTat': { roles: ['FOUNDER_ADMIN'], fn: adminUpdateTat_ },
  'admin.listHolidays': { roles: ['FOUNDER_ADMIN', 'EMPLOYEE'], fn: adminListHolidays_ },
  'admin.addHoliday': { roles: ['FOUNDER_ADMIN'], fn: adminAddHoliday_ },
  'admin.deleteHoliday': { roles: ['FOUNDER_ADMIN'], fn: adminDeleteHoliday_ },

  'matters.create': { roles: ['FOUNDER_ADMIN'], fn: mattersCreate_ },
  'matters.list': { roles: ['FOUNDER_ADMIN', 'EMPLOYEE'], fn: mattersList_ },
  'matters.get': { roles: ['FOUNDER_ADMIN', 'EMPLOYEE'], fn: mattersGet_ },
  'matters.completeStep1': { roles: ['EMPLOYEE'], fn: mattersCompleteStep1_ },
  'matters.completeStep2AndSubmit': { roles: ['EMPLOYEE'], fn: mattersCompleteStep2AndSubmit_ },
  'matters.founderDecision': { roles: ['FOUNDER_ADMIN'], fn: mattersFounderDecision_ },
  'matters.sendForClientApproval': { roles: ['EMPLOYEE'], fn: mattersSendForClientApproval_ },
  'matters.recordClientDecision': { roles: ['EMPLOYEE'], fn: mattersRecordClientDecision_ },
  'matters.submitToFounder': { roles: ['EMPLOYEE'], fn: mattersSubmitToFounder_ },
  'matters.sendForFiling': { roles: ['EMPLOYEE'], fn: mattersSendForFiling_ },
  'matters.completeFiling': { roles: ['EMPLOYEE'], fn: mattersCompleteFiling_ },
  'matters.requestTransfer': { roles: ['EMPLOYEE'], fn: mattersRequestTransfer_ },
  'matters.listTransferRequests': { roles: ['FOUNDER_ADMIN', 'EMPLOYEE'], fn: mattersListTransferRequests_ },
  'matters.decideTransfer': { roles: ['FOUNDER_ADMIN'], fn: mattersDecideTransfer_ },

  'court.punchIn': { roles: ['EMPLOYEE'], fn: courtPunchIn_ },
  'court.punchOut': { roles: ['EMPLOYEE'], fn: courtPunchOut_ },
  'court.myPunches': { roles: ['EMPLOYEE'], fn: courtMyPunches_ },
  'court.listAll': { roles: ['FOUNDER_ADMIN'], fn: courtListAll_ },

  'tasks.create': { roles: ['FOUNDER_ADMIN'], fn: tasksCreate_ },
  'tasks.list': { roles: ['FOUNDER_ADMIN', 'EMPLOYEE'], fn: tasksList_ },
  'tasks.get': { roles: ['FOUNDER_ADMIN', 'EMPLOYEE'], fn: tasksGet_ },
  'tasks.updateStatus': { roles: ['FOUNDER_ADMIN', 'EMPLOYEE'], fn: tasksUpdateStatus_ },
  'tasks.adminPushDueDate': { roles: ['FOUNDER_ADMIN'], fn: tasksAdminPushDueDate_ },
  'tasks.requestPushDueDate': { roles: ['EMPLOYEE'], fn: tasksRequestPushDueDate_ },
  'tasks.listPushRequests': { roles: ['FOUNDER_ADMIN', 'EMPLOYEE'], fn: tasksListPushRequests_ },
  'tasks.decidePushRequest': { roles: ['FOUNDER_ADMIN'], fn: tasksDecidePushRequest_ },

  'scoring.getLedger': { roles: ['FOUNDER_ADMIN', 'EMPLOYEE'], fn: scoringGetLedger_ },
  'scoring.getSummary': { roles: ['FOUNDER_ADMIN'], fn: scoringGetSummary_ },
  'scoring.recomputeOverdueNow': { roles: ['FOUNDER_ADMIN'], fn: scoringRecomputeOverdueNow_ },

  'dashboard.admin': { roles: ['FOUNDER_ADMIN'], fn: dashboardAdmin_ },
  'dashboard.employee': { roles: ['EMPLOYEE'], fn: dashboardEmployee_ }
};

function doGet(e) {
  return jsonResponse_({ ok: true, data: { service: 'jlaw-backend', status: 'healthy', time: nowIso_() } });
}

function doPost(e) {
  var responseObj;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new AppError_('VALIDATION_ERROR', 'Missing request body');
    }
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var token = body.token;
    var payload = body.payload || {};

    var handlerEntry = ACTIONS_[action];
    if (!handlerEntry) throw new AppError_('NOT_FOUND', 'Unknown action: ' + action);

    var auth = null;
    if (!handlerEntry.public) {
      auth = verifyToken_(token);
      requireRole_(auth, handlerEntry.roles);
    }

    var data = handlerEntry.fn(auth, payload);
    responseObj = { ok: true, data: data || {} };
  } catch (err) {
    responseObj = errorToResponse_(err);
  }
  return jsonResponse_(responseObj);
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function errorToResponse_(err) {
  if (err instanceof AppError_) {
    return { ok: false, error: { code: err.code, message: err.message, details: err.details } };
  }
  return { ok: false, error: { code: 'SERVER_ERROR', message: String((err && err.message) || err) } };
}

// =====================================================================
// 13. Setup. Not part of the request-handling path - run manually from
// the Apps Script editor, once, on a brand-new spreadsheet:
//   1. Edit the SETUP_ADMIN_* constants just below to your real name,
//      email, and a temporary password.
//   2. Select `setup` in the function dropdown next to the Run button
//      and click Run (approve the authorization prompt the first time).
//   3. Deploy > New deployment > Web app (Execute as Me, Access Anyone).
// `setup()` is idempotent - safe to run again later (e.g. after pulling
// in code changes) without duplicating tabs, triggers, or the admin user.
// =====================================================================

// EDIT these three values before running setup() the first time.
var SETUP_ADMIN_NAME_ = 'Founder Admin';
var SETUP_ADMIN_EMAIL_ = 'founder@jlawassociates.com';
var SETUP_ADMIN_PASSWORD_ = 'ChangeMe123!';

/**
 * The one function to run. Creates the 13 sheet tabs, the session-signing
 * secret, default TAT/config values, the first Founder/Admin login (from
 * the SETUP_ADMIN_* constants above), and the daily overdue-scoring
 * trigger - in order. Change the admin password immediately after your
 * first login.
 */
function setup() {
  setupDatabase();
  setupJwtSecret();
  seedDefaultConfig();
  bootstrapAdmin(SETUP_ADMIN_NAME_, SETUP_ADMIN_EMAIL_, SETUP_ADMIN_PASSWORD_);
  installDailyOverdueTrigger();
  Logger.log('Setup complete. Next: Deploy > New deployment > Web app (Execute as Me, Access Anyone).');
}

var SHEET_SCHEMAS_ = {
  Users: ['userId', 'name', 'email', 'passwordHash', 'passwordSalt', 'role', 'status', 'createdAt', 'lastLoginAt'],
  Sessions: ['jti', 'userId', 'issuedAt', 'expiresAt', 'revoked', 'userAgent'],
  Holidays: ['holidayId', 'date', 'label', 'createdAt', 'createdBy'],
  Config: ['key', 'value', 'unit', 'updatedAt', 'updatedBy'],
  Matters: [
    'matterId', 'type', 'title', 'clientName', 'employeeId', 'founderId', 'currentStep', 'status',
    'founderApprovedInCurrentRound', 'clientApprovedInCurrentRound', 'founderIterationCounter',
    'clientRoundCounter', 'createdAt', 'createdBy', 'updatedAt'
  ],
  MatterSteps: [
    'stepInstanceId', 'matterId', 'stepType', 'clientRoundNumber', 'tatValue', 'tatUnit', 'startedAt',
    'dueAt', 'completedAt', 'status', 'assignedEmployeeId', 'createdAt'
  ],
  ApprovalCycles: [
    'cycleId', 'matterId', 'cycleType', 'clientRoundNumber', 'founderIterationNumber', 'submittedAt',
    'submittedBy', 'decision', 'decisionNotes', 'decidedAt', 'decidedBy', 'scoredPoint', 'createdAt'
  ],
  TransferRequests: [
    'transferRequestId', 'matterId', 'fromEmployeeId', 'toEmployeeId', 'reason', 'requestedBy',
    'requestedAt', 'status', 'decidedBy', 'decidedAt', 'decisionNotes'
  ],
  CourtPunches: ['punchId', 'employeeId', 'punchInAt', 'punchOutAt', 'courtName', 'note', 'createdAt'],
  IndependentTasks: [
    'taskId', 'title', 'description', 'assignedTo', 'assignedBy', 'priority', 'dueAt', 'originalDueAt',
    'status', 'completedAt', 'createdAt', 'updatedAt'
  ],
  TaskPushRequests: [
    'pushRequestId', 'taskId', 'requestedBy', 'initiatedByRole', 'currentDueAt', 'requestedDueAt',
    'reason', 'status', 'requestedAt', 'decidedBy', 'decidedAt', 'decisionNotes'
  ],
  ScoreLedger: [
    'ledgerId', 'employeeId', 'eventType', 'points', 'refType', 'refId', 'relatedWorkingDate',
    'description', 'createdAt', 'createdBy'
  ],
  AuditLog: ['auditId', 'actorId', 'action', 'targetType', 'targetId', 'detailsJson', 'createdAt']
};

/** Creates all 13 tabs (if missing) with header rows, frozen header, and
 * text-formatted data columns (avoids Sheets auto-converting ISO date
 * strings / IDs into Date-typed or numeric cells). Safe to re-run. */
function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(SHEET_SCHEMAS_).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    var headers = SHEET_SCHEMAS_[name];

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);

    var targetRows = Math.max(sheet.getMaxRows(), 1000);
    if (sheet.getMaxRows() < targetRows) sheet.insertRowsAfter(sheet.getMaxRows(), targetRows - sheet.getMaxRows());
    sheet.getRange(1, 1, targetRows, headers.length).setNumberFormat('@');
  });

  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && SHEET_SCHEMAS_.hasOwnProperty('Sheet1') === false) {
    ss.deleteSheet(defaultSheet);
  }

  Logger.log('Database setup complete. Tabs: ' + Object.keys(SHEET_SCHEMAS_).join(', '));
}

/** Generates and stores the HMAC signing secret used for session tokens. Idempotent. */
function setupJwtSecret() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('JWT_SECRET')) {
    Logger.log('JWT_SECRET is already set - leaving it unchanged.');
    return;
  }
  props.setProperty('JWT_SECRET', Utilities.getUuid() + Utilities.getUuid());
  Logger.log('JWT_SECRET generated and stored in Script Properties.');
}

/** Seeds default TAT durations, session TTL, and ID sequence counters. Safe to re-run (overwrites). */
function seedDefaultConfig() {
  setConfigValue_('TAT_STEP1', '2', 'DAYS', 'SYSTEM');
  setConfigValue_('TAT_STEP2', '3', 'DAYS', 'SYSTEM');
  setConfigValue_('TAT_CLIENT_APPROVAL', '2', 'DAYS', 'SYSTEM');
  setConfigValue_('TAT_FILING', '1', 'DAYS', 'SYSTEM');
  setConfigValue_('SESSION_TTL_HOURS', '12', '', 'SYSTEM');
  if (getConfigValue_('SEQ_MATTER') === null) setConfigValue_('SEQ_MATTER', '0', '', 'SYSTEM');
  if (getConfigValue_('SEQ_TASK') === null) setConfigValue_('SEQ_TASK', '0', '', 'SYSTEM');
  Logger.log('Default config seeded. Adjust TAT values under Admin > Config in the app once it is live.');
}

/**
 * Creates the very first Founder/Admin account directly against the
 * sheet (bypassing the API, since there is no self-signup). Called by
 * setup() above with the SETUP_ADMIN_* constants - only call directly if
 * you need to bootstrap a second admin by hand from the editor.
 */
function bootstrapAdmin(name, email, password) {
  email = String(email || '').trim().toLowerCase();
  if (!name || !email || !password) throw new Error('name, email and password are all required');
  if (password.length < 8) throw new Error('password must be at least 8 characters');

  var existing = findOne('Users', function (u) { return String(u.email).toLowerCase() === email; });
  if (existing) {
    Logger.log('A user with that email already exists: ' + email);
    return;
  }

  var salt = makeSalt_();
  appendRow('Users', {
    userId: Utilities.getUuid(),
    name: name,
    email: email,
    passwordHash: hashPassword_(password, salt),
    passwordSalt: salt,
    role: 'FOUNDER_ADMIN',
    status: 'ACTIVE',
    createdAt: nowIso_(),
    lastLoginAt: ''
  });
  Logger.log('Bootstrapped Founder/Admin: ' + email + ' - log in and change the password immediately.');
}

/**
 * Installs the daily overdue-scoring trigger. Called by setup() above;
 * re-running clears any previous scheduledOverdueScan trigger first so
 * duplicates never accumulate.
 */
function installDailyOverdueTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'scheduledOverdueScan') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('scheduledOverdueScan').timeBased().everyDays(1).atHour(1).create();
  Logger.log('Daily overdue-scan trigger installed (runs ~1am script time zone).');
}

/**
 * Seeds realistic demo data by driving the SAME handler functions the
 * live API uses (not raw row inserts), so every seeded matter/task is
 * guaranteed to be in a self-consistent state: 3 demo Employees, 6
 * Matters spanning every stage of the workflow (fresh, mid-draft,
 * awaiting first founder review, a founder-notes round that scored a
 * resubmission point, a fully completed matter, and one with a
 * backdated overdue step + a pending transfer request), a handful of
 * Independent Tasks (including an overdue one and one with a pending
 * due-date push request), and some Court Punch history. Ends by running
 * the overdue scan so the Scoreboard has real numbers to show.
 *
 * Requires setup() to have already run (needs TAT config + an existing
 * Founder/Admin user). Safe to re-run - skips entirely if the demo
 * employees already exist, rather than creating duplicates.
 */
function seedDummyData() {
  if (findOne('Users', function (u) { return String(u.email).toLowerCase() === 'asha.demo@jlawassociates.com'; })) {
    Logger.log('Demo data already seeded (asha.demo@jlawassociates.com exists) - skipping. Delete that user first if you want to reseed.');
    return;
  }

  var adminUser = findOne('Users', function (u) { return u.role === 'FOUNDER_ADMIN' && u.status === 'ACTIVE'; });
  if (!adminUser) throw new Error('No active Founder/Admin found. Run setup() first.');
  var adminAuth = { userId: adminUser.userId, role: 'FOUNDER_ADMIN' };

  function createDemoEmployee(name, email) {
    var salt = makeSalt_();
    var user = {
      userId: Utilities.getUuid(),
      name: name,
      email: email,
      passwordHash: hashPassword_('DemoPass123!', salt),
      passwordSalt: salt,
      role: 'EMPLOYEE',
      status: 'ACTIVE',
      createdAt: nowIso_(),
      lastLoginAt: ''
    };
    appendRow('Users', user);
    return user;
  }

  function offsetIso_(days) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  function demoPunch(employeeId, daysAgo, startHour, endHour, courtName) {
    var day = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    var inAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, 0, 0);
    var outAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endHour, 0, 0);
    appendRow('CourtPunches', {
      punchId: Utilities.getUuid(),
      employeeId: employeeId,
      punchInAt: inAt.toISOString(),
      punchOutAt: outAt.toISOString(),
      courtName: courtName,
      note: '',
      createdAt: inAt.toISOString()
    });
  }

  var asha = createDemoEmployee('Asha Employee', 'asha.demo@jlawassociates.com');
  var rahul = createDemoEmployee('Rahul Employee', 'rahul.demo@jlawassociates.com');
  var priya = createDemoEmployee('Priya Employee', 'priya.demo@jlawassociates.com');
  var ashaAuth = { userId: asha.userId, role: 'EMPLOYEE' };
  var rahulAuth = { userId: rahul.userId, role: 'EMPLOYEE' };
  var priyaAuth = { userId: priya.userId, role: 'EMPLOYEE' };

  // Matter 1: fresh, still on Step 1.
  mattersCreate_(adminAuth, { type: 'LITIGATION', title: 'Sharma vs. Verma - Property Dispute', clientName: 'Mr. Sharma', employeeId: asha.userId });

  // Matter 2: through Step 1, now on Step 2.
  var m2 = mattersCreate_(adminAuth, { type: 'NON_LITIGATION', title: 'ACME Corp - Contract Review', clientName: 'ACME Corp', employeeId: rahul.userId }).matter;
  mattersCompleteStep1_(rahulAuth, { matterId: m2.matterId });

  // Matter 3: submitted to founder, awaiting first review (iteration 1, unscored).
  var m3 = mattersCreate_(adminAuth, { type: 'NON_LITIGATION', title: 'Gupta Family Trust Formation', clientName: 'Gupta Family', employeeId: priya.userId }).matter;
  mattersCompleteStep1_(priyaAuth, { matterId: m3.matterId });
  mattersCompleteStep2AndSubmit_(priyaAuth, { matterId: m3.matterId, notes: 'First draft ready for review.' });

  // Matter 4: founder requested changes once, employee resubmitted (iteration 2, scored) - still pending.
  var m4 = mattersCreate_(adminAuth, { type: 'LITIGATION', title: 'Mehta vs. State - Criminal Appeal', clientName: 'Mehta', employeeId: asha.userId }).matter;
  mattersCompleteStep1_(ashaAuth, { matterId: m4.matterId });
  var m4Cycle1 = mattersCompleteStep2AndSubmit_(ashaAuth, { matterId: m4.matterId }).cycle;
  mattersFounderDecision_(adminAuth, { matterId: m4.matterId, cycleId: m4Cycle1.cycleId, decision: 'CHANGES_REQUESTED', notes: 'Please add the recent case citations.' });
  mattersSubmitToFounder_(ashaAuth, { matterId: m4.matterId, notes: 'Added the requested citations.' });

  // Matter 5: full happy path through to completion.
  var m5 = mattersCreate_(adminAuth, { type: 'NON_LITIGATION', title: 'Patel Divorce Settlement', clientName: 'Patel', employeeId: rahul.userId }).matter;
  mattersCompleteStep1_(rahulAuth, { matterId: m5.matterId });
  var m5Cycle1 = mattersCompleteStep2AndSubmit_(rahulAuth, { matterId: m5.matterId }).cycle;
  mattersFounderDecision_(adminAuth, { matterId: m5.matterId, cycleId: m5Cycle1.cycleId, decision: 'APPROVED', notes: 'Looks good.' });
  var m5ClientCycle = mattersSendForClientApproval_(rahulAuth, { matterId: m5.matterId }).cycle;
  mattersRecordClientDecision_(rahulAuth, { matterId: m5.matterId, cycleId: m5ClientCycle.cycleId, decision: 'APPROVED', notes: 'Client signed off.' });
  mattersSendForFiling_(rahulAuth, { matterId: m5.matterId });
  mattersCompleteFiling_(rahulAuth, { matterId: m5.matterId });

  // Matter 6: Step 2 backdated to overdue, plus a pending transfer request.
  var m6 = mattersCreate_(adminAuth, { type: 'LITIGATION', title: 'Kumar Land Acquisition', clientName: 'Kumar Estates', employeeId: priya.userId }).matter;
  mattersCompleteStep1_(priyaAuth, { matterId: m6.matterId });
  var m6Step2 = findOpenStep_(m6.matterId, 'STEP2_BRIEF');
  if (m6Step2) {
    updateById('MatterSteps', 'stepInstanceId', m6Step2.stepInstanceId, { startedAt: offsetIso_(-5), dueAt: offsetIso_(-3) });
  }
  mattersRequestTransfer_(priyaAuth, { matterId: m6.matterId, toEmployeeId: rahul.userId, reason: 'Priya is overloaded this month; moving to Rahul.' });

  // Independent tasks.
  tasksCreate_(adminAuth, { employeeId: asha.userId, title: 'File RTI application', description: 'Submit RTI for the Sharma matter records.', priority: 'HIGH', dueAt: offsetIso_(3) });
  tasksCreate_(adminAuth, { employeeId: asha.userId, title: 'Prepare witness list', description: '', priority: 'MEDIUM', dueAt: offsetIso_(7) });
  tasksCreate_(adminAuth, { employeeId: rahul.userId, title: 'Review NDA draft', description: 'ACME wants this back within 24 hours.', priority: 'URGENT', dueAt: offsetIso_(1) });
  var rahulOverdueTask = tasksCreate_(adminAuth, { employeeId: rahul.userId, title: 'Client call follow-up', description: '', priority: 'LOW', dueAt: offsetIso_(-2) }).task;
  tasksRequestPushDueDate_(rahulAuth, { taskId: rahulOverdueTask.taskId, requestedDueAt: offsetIso_(2), reason: 'Client was unavailable this week, rescheduling the call.' });
  tasksCreate_(adminAuth, { employeeId: priya.userId, title: 'Update case diary', description: '', priority: 'MEDIUM', dueAt: offsetIso_(5) });
  var priyaOverdueTask = tasksCreate_(adminAuth, { employeeId: priya.userId, title: 'Draft affidavit', description: '', priority: 'HIGH', dueAt: offsetIso_(-1) }).task;
  tasksUpdateStatus_(priyaAuth, { taskId: priyaOverdueTask.taskId, status: 'IN_PROGRESS' });

  // Court punch history - two closed, one left open to demo the "currently in court" banner.
  demoPunch(asha.userId, 1, 10, 13, 'District Court, Room 4');
  demoPunch(rahul.userId, 2, 11, 15, 'High Court');
  courtPunchIn_(priyaAuth, { courtName: 'Sessions Court', note: 'Bail hearing' });

  // True-up overdue scoring for the backdated matter step and tasks above.
  runOverdueScan_();

  invalidateCaches_(['cache_employees_list', 'cache_users_list']);

  Logger.log(
    'Demo data seeded: 3 employees (asha.demo@jlawassociates.com / rahul.demo@jlawassociates.com / ' +
      'priya.demo@jlawassociates.com, password DemoPass123!), 6 matters, 6 tasks, 3 court punches, ' +
      '1 pending transfer request, 1 pending task push request.'
  );
}

// =====================================================================
// 14. Self-tests for the working-time algorithm above. Run
// runSelfTests() manually from the Apps Script editor and check the
// execution log - not wired into any request path.
// =====================================================================

function runSelfTests() {
  var results = [];

  function check(label, actual, expected) {
    var pass = actual === expected;
    results.push((pass ? 'PASS' : 'FAIL') + ' - ' + label + ' -> got ' + actual + ', expected ' + expected);
  }

  // Wed 2026-08-05, no holidays: +2 working days -> Fri 2026-08-07
  var holidaySet = {};
  var start1 = new Date('2026-08-05T10:00:00');
  var due1 = addWorkingDays_(start1, 2, holidaySet);
  check('addWorkingDays_ over a plain week', dateOnlyStr_(due1), '2026-08-07');

  // Fri 2026-08-07, no holidays: +1 working day -> Mon 2026-08-10 (skips Sat/Sun)
  var start2 = new Date('2026-08-07T15:00:00');
  var due2 = addWorkingDays_(start2, 1, holidaySet);
  check('addWorkingDays_ skips a weekend', dateOnlyStr_(due2), '2026-08-10');

  // Fri 2026-08-07, holiday on Mon 2026-08-10: +1 working day -> Tue 2026-08-11
  var holidaySetWithHoliday = { '2026-08-10': true };
  var due3 = addWorkingDays_(start2, 1, holidaySetWithHoliday);
  check('addWorkingDays_ skips a weekend + a holiday', dateOnlyStr_(due3), '2026-08-11');

  // Fri 2026-08-07 20:00 + 10 hours, no holidays: 4h left in Friday, then Sat+Sun
  // skipped wholesale, remaining 6h consumed from Mon 00:00 -> Mon 06:00
  var start4 = new Date('2026-08-07T20:00:00');
  var due4 = addWorkingHours_(start4, 10, holidaySet);
  check('addWorkingHours_ skips a weekend wholesale', dateOnlyStr_(due4), '2026-08-10');
  check('addWorkingHours_ lands at 06:00 after rollover', due4.getHours(), 6);

  // workingDaysLate_: due Wed 2026-08-05, reference Mon 2026-08-10 ->
  // Thu, Fri, Mon count = 3 (Sat/Sun skipped, reference day itself included)
  var dueDate = new Date('2026-08-05T10:00:00');
  var refDate = new Date('2026-08-10T10:00:00');
  check('workingDaysLate_ skips the weekend', workingDaysLate_(dueDate, refDate, holidaySet), 3);

  // workingDaysLate_ with a holiday on the Monday inside the late window -> Thu, Fri only = 2
  check('workingDaysLate_ skips a holiday too', workingDaysLate_(dueDate, refDate, holidaySetWithHoliday), 2);

  // workingDaysLate_ before/at dueAt -> 0
  check('workingDaysLate_ is 0 when not late', workingDaysLate_(dueDate, dueDate, holidaySet), 0);

  Logger.log(results.join('\n'));
  var failed = results.filter(function (r) { return r.indexOf('FAIL') === 0; });
  Logger.log(failed.length === 0 ? 'ALL TESTS PASSED' : failed.length + ' TEST(S) FAILED');
  return results;
}

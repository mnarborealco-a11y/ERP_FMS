# Deployment Guide

## Backend (Supabase)

The Supabase project (`cziglwqqellxnpzavxks`, region ap-southeast-1) already has the full schema, RLS policies, RPC functions, the `create-user` Edge Function, and the daily `pg_cron` overdue-scan job deployed. To stand up a **new** environment from scratch (e.g. a separate staging project):

1. **Create a Supabase project.** Note its project ref, region, and Postgres version.
2. **Apply the schema.** Every migration is idempotent-by-construction (fresh objects, `create or replace function`) and was applied via `mcp__supabase__apply_migration` — replay them in order against the new project (see `mcp__supabase__list_migrations` on the source project for the exact sequence: enums → sequences/profiles/trigger → holidays/tat_settings → matters/steps/cycles/transfers → punches/tasks/push-requests → score_ledger → RLS helpers/policies → TAT math functions → RPC functions → grants).
3. **Enable `pg_cron`** (`create extension if not exists pg_cron;`) and schedule the daily scan: `select cron.schedule('overdue-scan-daily', '30 19 * * *', $$select public.run_overdue_scan()$$);` — the schedule is in **UTC**; `30 19 * * *` UTC = 1:00 AM IST (`Asia/Kolkata`). Recompute the offset if the firm's timezone differs — don't assume a round-hour conversion.
4. **Deploy the `create-user` Edge Function** (source lives in this session's scratch history; recreate from `frontend/lib` conventions if not preserved — it's a small Deno function that calls `supabase.auth.admin.createUser` with a bootstrap path for the very first account). Deploy with `verify_jwt: false` (it implements its own auth check inside the function body).
5. **Bootstrap the first Founder/Admin.** POST to the deployed `create-user` function with `{email, name, role: "FOUNDER_ADMIN", initialPassword}` and no `Authorization` header — this only works once, before any `FOUNDER_ADMIN` profile exists; every call after that requires a caller JWT belonging to an active Founder/Admin. **Change the password immediately after first login** (Profile page, or `supabase.auth.admin.updateUserById`).
6. **TAT defaults** are seeded automatically by the schema migration (`STEP1`=2 DAYS, `STEP2`=3 DAYS, `CLIENT_APPROVAL`=2 DAYS, `FILING`=1 DAY) — edit from Admin > TAT & Holidays after logging in.
7. **Verify TAT math**, if you touched any of `add_working_days`/`add_working_hours`/`working_days_late`/`compute_due_at`: re-run the fixture checks (7 assertions anchored on business-day/weekend/holiday edge cases) via `mcp__supabase__execute_sql` before trusting any due-date output — this logic silently drives every deadline and scoring point in the app.

## Frontend (Next.js on Vercel)

1. `npm install` (from the repo root — the Next.js app lives there, alongside the non-Next.js `backend/` and `docs/` sibling directories).
2. Copy `.env.local.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL` — from `mcp__supabase__get_project_url`, or Project Settings > API in the Supabase dashboard.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the `anon`/publishable key from `mcp__supabase__get_publishable_keys`, or Project Settings > API.
3. `npm run dev` to run locally at http://localhost:3000.
4. Push this repo to a Git provider (GitHub/GitLab/Bitbucket).
5. In Vercel: New Project > import the repo (no Root Directory change needed — the Next.js app is at the repo root, so Vercel auto-detects it) > add the `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variables (same values as `.env.local`) > Deploy.
6. **Verify end-to-end**: open the deployed Vercel URL, log in with the bootstrapped Founder/Admin account, and confirm the dashboard loads. Since Supabase's REST/Auth endpoints are same-origin-agnostic (proper CORS support, unlike the old Apps Script Web App), there's no CORS workaround needed here — if login fails, check the browser console for the actual Supabase error message first.

## Notes

- There is no self-signup. All accounts (both Founder/Admin and Employee) are created from **Admin > Users** in the app, which calls the `create-user` Edge Function, by an existing Founder/Admin, after the one bootstrapped account above.
- To roll back or fix bad data, use `mcp__supabase__execute_sql` directly against Postgres — it is the source of truth. Avoid writing directly to `score_ledger` (append-only by RLS design; only the scoring RPCs can insert) or bypassing the RPC functions for matter/task state changes, since those functions enforce invariants (ownership, state-machine preconditions, idempotent scoring) that a raw `UPDATE` would skip.
- If admin actions ever fail with `FORBIDDEN`, check that the caller's session JWT actually carries `app_metadata.role = 'FOUNDER_ADMIN'` (log out/in refreshes it) — role changes made via `admin_update_user` force a re-login by deleting the target's sessions, so a stale tab's cached session can look like a permissions bug when it's actually just an unrefreshed token.
- Regenerate `types/supabase.ts` after any schema change: `mcp__supabase__generate_typescript_types`, then copy the output in.

---

## Archived: Google Apps Script + Sheets backend (decommissioned)

The app originally ran on Google Apps Script + Google Sheets before migrating to Supabase (see root `CLAUDE.md` for why and what changed). `backend/backend.gs` and `backend/appsscript.json` are kept in the repo for historical reference only — **do not deploy or extend this**; it is not connected to anything live.

<details>
<summary>Original Apps Script deployment steps (historical)</summary>

1. **Create the database spreadsheet.** In Google Drive, create a new Google Sheet — this was the entire database. Name it e.g. "Jlaw Associates - Ops DB".
2. **Open the bound Apps Script project.** Extensions > Apps Script.
3. **Copy in the code.** The entire backend was one file, `backend/backend.gs`. In the Apps Script editor, delete the default `Code.gs` content and paste in `backend/backend.gs`. Also replace the `appsscript.json` manifest with `backend/appsscript.json`.
4. **Set the script's time zone** (`Asia/Kolkata` default in `appsscript.json`).
5. **Run `setup()`** after editing the `SETUP_ADMIN_*` constants — created all sheet tabs, the JWT secret, default TAT config, the first Founder/Admin login, and the daily overdue-scan trigger.
6. **(Optional) `seedDummyData()`** for demo data.
7. **(Optional) `runSelfTests()`** for the TAT algorithm self-tests.
8. **Deploy as a Web App** (Execute as: Me, Who has access: Anyone), copy the `/exec` URL.
9. **Re-deploy after every edit** via Deploy > Manage deployments > edit > New version, since the `/exec` URL is pinned to a deployment version.

The frontend talked to this via `NEXT_PUBLIC_APPS_SCRIPT_URL` and a `text/plain` CORS workaround (Apps Script Web Apps can't answer a CORS preflight) — both fully removed from the current frontend.

</details>

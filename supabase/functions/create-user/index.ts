// Admin-only user creation, replacing backend.gs's admin.createUser action.
// verify_jwt is disabled at deploy time because this function implements its
// own auth. Three cases:
//   1. Bootstrap: no SUPER_ADMIN profile exists yet -- the only account this
//      endpoint may create right now is the platform's first Super Admin, no
//      caller auth required (there's no admin yet to have signed a request).
//      Once one SUPER_ADMIN profile exists, this path is permanently closed.
//   2. Caller is an active SUPER_ADMIN -- may create a FOUNDER_ADMIN for any
//      companyId given in the request body (this is how a new company gets
//      its first admin). Company-scoped seat limits don't apply to this path
//      -- onboarding a company's first admin isn't counted against a seat
//      limit that was just set moments earlier.
//   3. Caller is an active FOUNDER_ADMIN -- may create EMPLOYEE/FOUNDER_ADMIN
//      accounts, always stamped with the CALLER'S OWN companyId. A
//      client-supplied companyId is never trusted in this branch -- that's
//      exactly the spot a naive multi-tenant port would open a cross-tenant
//      hole.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, code: string, message: string) {
  return jsonResponse(status, { ok: false, error: { code, message } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "VALIDATION_ERROR", "POST only");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  let body: { email?: string; name?: string; role?: string; initialPassword?: string; companyId?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "VALIDATION_ERROR", "Invalid JSON body");
  }

  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const initialPassword = String(body.initialPassword || "");
  let role = String(body.role || "");
  let companyId: string | null = body.companyId ? String(body.companyId) : null;

  if (!email || !name || initialPassword.length < 8) {
    return errorResponse(400, "VALIDATION_ERROR", "email, name, and an initialPassword of at least 8 characters are required");
  }

  const { count: superAdminCount, error: countError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "SUPER_ADMIN");
  if (countError) {
    return errorResponse(500, "SERVER_ERROR", countError.message);
  }

  const isBootstrap = (superAdminCount ?? 0) === 0;

  if (isBootstrap) {
    role = "SUPER_ADMIN";
    companyId = null;
  } else {
    if (role !== "FOUNDER_ADMIN" && role !== "EMPLOYEE") {
      return errorResponse(400, "VALIDATION_ERROR", "role must be FOUNDER_ADMIN or EMPLOYEE");
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return errorResponse(401, "UNAUTHORIZED", "Missing Authorization header");
    }
    const { data: callerData, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !callerData?.user) {
      return errorResponse(401, "UNAUTHORIZED", "Invalid or expired session");
    }
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role, status, company_id")
      .eq("id", callerData.user.id)
      .single();
    if (!callerProfile || callerProfile.status !== "ACTIVE") {
      return errorResponse(403, "FORBIDDEN", "Only an active Super Admin or Founder/Admin can create users");
    }

    if (callerProfile.role === "SUPER_ADMIN") {
      if (role !== "FOUNDER_ADMIN") {
        return errorResponse(400, "VALIDATION_ERROR", "Super Admin can only create a company's Founder/Admin account");
      }
      if (!companyId) {
        return errorResponse(400, "VALIDATION_ERROR", "companyId is required");
      }
      const { data: company } = await admin.from("companies").select("id, status").eq("id", companyId).single();
      if (!company) {
        return errorResponse(404, "NOT_FOUND", "Company not found");
      }
      if (company.status !== "ACTIVE") {
        return errorResponse(409, "CONFLICT", "Company is suspended");
      }
    } else if (callerProfile.role === "FOUNDER_ADMIN") {
      // Never trust a client-supplied companyId here -- always the caller's own.
      companyId = callerProfile.company_id;

      const { data: company } = await admin.from("companies").select("status, max_users").eq("id", companyId).single();
      if (!company || company.status !== "ACTIVE") {
        return errorResponse(409, "CONFLICT", "Company is suspended");
      }
      const { count: activeCount } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("status", "ACTIVE");
      if ((activeCount ?? 0) >= company.max_users) {
        return errorResponse(
          409,
          "CONFLICT",
          `Company has reached its user seat limit (${activeCount}/${company.max_users}). Contact your platform administrator to increase it.`
        );
      }
    } else {
      return errorResponse(403, "FORBIDDEN", "Only an active Super Admin or Founder/Admin can create users");
    }
  }

  const appMetadata: Record<string, unknown> = { role };
  if (companyId) appMetadata.company_id = companyId;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: initialPassword,
    email_confirm: true,
    app_metadata: appMetadata,
    user_metadata: { name },
  });
  if (createError || !created?.user) {
    const message = createError?.message || "Failed to create user";
    const status = /already registered|already exists/i.test(message) ? 409 : 500;
    return errorResponse(status, status === 409 ? "CONFLICT" : "SERVER_ERROR", message);
  }

  return jsonResponse(200, { ok: true, data: { userId: created.user.id, email, name, role, companyId } });
});

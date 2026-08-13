# Jlaw Associates — Ops App

Internal, cloud-hosted tool for a law firm's own use (not a multi-tenant product, despite "SaaS" in the original ask — that just meant "hosted web app"). Covers four requirements: matter workflow (FMS) for Litigation and Non-Litigation matters, court appearance logging, independent task assignment, and auto-computed employee scoring.

## Architecture

- **Backend**: Supabase (Postgres project `cziglwqqellxnpzavxks`, region ap-southeast-1). All business logic lives in Postgres `plpgsql` functions exposed via `supabase.rpc()`; simple CRUD (holidays, list reads) goes straight through RLS-gated table/view access from the frontend. One Edge Function (`create-user`) handles admin-only user creation via the Supabase Auth Admin API.
- **Frontend**: Next.js 16 (App Router, TypeScript, Tailwind v4) at the repo root, deployed to Vercel (zero-config — `backend/` and `docs/` are non-Next.js siblings and are simply ignored by the Next.js build). Talks to Supabase directly via `@supabase/supabase-js` — no custom API envelope.
- **Auth**: native Supabase Auth (GoTrue). No self-signup — every account is created by an existing Founder/Admin via the `create-user` Edge Function, after the one bootstrapped account.
- Migrated off Google Apps Script + Google Sheets (`backend/backend.gs`, now archived — see "Decommissioned backend" below). See `docs/DEPLOYMENT.md` for full setup/deploy steps.

## Database schema

13 Postgres tables replace the old 13 Sheet tabs, with several deliberate deviations from a 1:1 mapping — **do not "fix" these back**:

| Old Sheet | Now | Why |
|---|---|---|
| `Sessions` | Gone | Superseded by GoTrue's own `auth.sessions`. |
| `Config` (TAT rows) | Gone — replaced by per-matter `matter_tat_settings` | There is no global TAT template anymore. TAT is opt-in per matter, per step (`STEP1`/`STEP2`/`CLIENT_APPROVAL`/`FILING`), set once at matter-creation time via `matters_create`'s `p_tat` param. A step with no matching row has no due date at all — not an error, just no timeline for that step. |
| `Config.SESSION_TTL_HOURS` | Gone | Now a Supabase Auth project setting, not app data. |
| `Config.SEQ_MATTER`/`SEQ_TASK` | Real Postgres `SEQUENCE`s (`matter_seq`, `task_seq`), never client-readable | Old `admin.getConfig` used to leak these as if they were settings — a sequence can't leak by construction. |
| `Users` | `auth.users` (GoTrue: email/password/identity) + `profiles` (role/status/name), 1:1 via `profiles.id = auth.users.id` | Native auth. |
| `AuditLog` | Not recreated | Confirmed 100% dead code in the old backend — never written to. |
| `ScoreLedger.relatedWorkingDate` | Column dropped | Confirmed always blank in the old backend. |
| `Matters.status` `ON_HOLD` | Not in the enum (`IN_PROGRESS`/`COMPLETED`/`CANCELLED` only) | Existed in old frontend types but no handler ever produced it — a stale mismatch, not a real state. |

Human-readable IDs (`M-000123`, `T-000123`) are still generated, now from `matter_seq`/`task_seq` via `nextval()` inside `matters_create`/`tasks_create` — lock-free by construction, replacing the old `LockService`-guarded counter.

## RLS + auth model

- **Role** comes straight from the JWT's `app_metadata.role` claim — GoTrue includes `app_metadata` in every access token by default, so **no Custom Access Token Hook is needed** (confirmed working; don't add one, it'd be redundant). Role is set at user-creation time by the `create-user` Edge Function and updated via the `admin_update_user` RPC, which also deletes the target's `auth.sessions` rows so a role/status change takes effect on the user's very next request rather than waiting for token refresh.
- **Active/disabled status** is checked live via `is_active_caller()` (a `SECURITY DEFINER stable` helper), not from a JWT claim, since it must be immediate.
- Every operational table (`matters`, `matter_steps`, `approval_cycles`, `transfer_requests`, `court_appearances`, `independent_tasks`, `task_push_requests`, `score_ledger`, `profiles`) has RLS enabled with **SELECT-only policies** — all `INSERT`/`UPDATE`/`DELETE` grants are revoked from `authenticated`. Every mutation goes through a `SECURITY DEFINER` RPC that reimplements the ownership/state checks internally (these functions bypass RLS as the table owner — that's the intended, reviewed design, not a gap; `get_advisors` will always flag them as "SECURITY DEFINER callable by authenticated," which is expected here). `score_ledger` is append-only in practice for exactly this reason: employees can `SELECT` their own rows, but only `score_overdue_for_ref`/`matters_submit_to_founder` (never a raw client insert) can write.
- `holidays` is simple enough to stay direct RLS-gated table access (read: any active user; write: admin only) — no RPC wrapper. `matter_tat_settings` is SELECT-only via RLS (any active user) like the other operational tables — only `matters_create` can write to it, and only at matter-creation time; there is no edit-TAT-later RPC.
- `active_employees` is a narrow view (`id, name` for active `EMPLOYEE`-role profiles only) — intentionally a `SECURITY DEFINER`-style view (Postgres's default) so it can show the directory to any authenticated user without needing `profiles`' own RLS (which restricts non-admins to their own row) to also expose it. Reviewed and accepted by `get_advisors` standards for this reason — don't "fix" it into a `security_invoker` view, that would break the employee dropdown for non-admins.

## RPC catalog

Business logic lives in ~25 `plpgsql` functions (see the `supabase/` migration history via `mcp__supabase__list_migrations`, or `mcp__supabase__execute_sql` against `pg_proc` for current definitions). Naming: `matters_*`/`tasks_*`/`court_*`/`scoring_*`/`dashboard_*`, called from the frontend via `callApi(rpcName, {p_param: value})` in `lib/apiClient.ts`. Key ones:

- **State machine**: `matters_create` → `matters_complete_step1` → `matters_complete_step2_and_submit` → `matters_founder_decision` → `matters_send_for_client_approval` → `matters_record_client_decision` → `matters_send_for_filing` → `matters_complete_filing`, with `matters_submit_to_founder` handling every revision resubmission. **`matters_complete_step2_and_submit` (creates founder-iteration 1, never scored) and `matters_submit_to_founder` (every iteration ≥2, always scored) are deliberately two separate functions** — this mirrors a hard constraint from the original backend and must not be merged into one with an `is_first` branch.
- **TAT/business-day math**: `add_working_days`, `add_working_hours`, `compute_due_at`, `working_days_late`, `is_non_working_day` — structural ports of the original Apps Script algorithms (same chunk-at-a-time loop logic, not a "clever" set-based rewrite), anchored to `Asia/Kolkata` explicitly via `at time zone`. Verified against the original `runSelfTests()` fixtures (all 7 pass) — if you touch this code, re-run that verification, don't just trust a refactor.
- **Idempotent scoring**: `score_overdue_for_ref` — replaces the old single global `LockService` lock with a per-`(ref_type,ref_id,event_type)` `pg_advisory_xact_lock` (auto-released at transaction end, unrelated refs no longer block each other). Diffs "working days late as of now" against what's already on the ledger for that exact ref and only appends the delta. Called from every step/task completion path (true-up) and from `run_overdue_scan()` (daily scan + manual "recompute" button).
- **Dashboards**: `dashboard_admin`/`dashboard_employee` return one JSON blob each (aggregating 5-6 tables server-side) rather than being composed from multiple client-side queries — keeps one round trip per screen.
- **Admin CRUD escape hatches**: `matters_admin_update`/`tasks_admin_update` let Founder/Admin edit metadata directly (matter `title`/`client_name`; task `title`/`description`/`priority`) at any point in the workflow, bypassing the state machine entirely since these fields don't affect it. Employee reassignment deliberately stays out of `matters_admin_update` — it still goes through `matters_request_transfer` → `matters_decide_transfer` so open steps get reassigned for scoring attribution; don't fold reassignment into the edit RPC. Task due-date changes stay out of `tasks_admin_update` too, for the same reason `tasks_admin_push_due_date` exists as its own function — it also writes an `AUTO_APPROVED` `task_push_requests` audit row. `matters_admin_delete`/`tasks_admin_delete` hard-delete a matter (+ its `matter_steps`/`approval_cycles`/`transfer_requests`/`matter_tat_settings`) or task (+ its `task_push_requests`); `score_ledger` is deliberately never touched by either — it's append-only and `ref_id` is a plain `text` column with no FK, so past scoring events just outlive a deleted matter/task, which is intended, not a bug.
- **Court appearances**: `court_appearances` (replaced the old punch-in/punch-out `court_punches` model) is a dated log entry, not a live clock — each row is `matter_id` (required, must be one of the caller's own matters), `court_name` (required), `appearance_date` (required, employee-settable and deliberately backdatable, but `court_appearances_create` rejects future dates), and an optional `note`. Written only via `court_appearances_create` (Employee only). There's no "currently punched in" state anymore, so `dashboard_employee` no longer returns `myOpenCourtPunch` — don't reintroduce it.

## Scheduled job

`pg_cron` (enabled on this project) runs `run_overdue_scan()` daily via the job `overdue-scan-daily`, schedule `30 19 * * *` — **that's UTC**; `Asia/Kolkata` is UTC+5:30, so 19:30 UTC = 1:00 AM IST, matching the original backend's daily trigger time. If you ever need to change the scan time, remember the half-hour offset — don't just convert as if IST were a round UTC+5 or UTC+6.

## Frontend conventions (repo root: `app/`, `lib/`, `components/`, `types/`)

- `lib/apiClient.ts`'s `callApi<T>(rpcName, params)` is a thin wrapper around `supabase.rpc()`, normalizing `PostgrestError` back into the same `ApiError{code,message,details}` shape the UI already branches on (parses the `'CODE: message'` prefix every RPC's `raise exception` uses). Direct table/view reads (lists, holidays) go straight through the `supabase` client exported from `lib/supabaseClient.ts`, not through `callApi`.
- `lib/auth.tsx` is backed by `supabase.auth` — session restore uses `supabase.auth.getSession()`/`onAuthStateChange`, and role is read from `session.user.app_metadata.role` (already parsed by supabase-js, no manual JWT decoding needed, no extra round trip — same property the old hand-rolled `decodeToken()` was optimizing for).
- **All row field names are now snake_case** (`matter.matter_id`, `matter.current_step`, `task.assigned_to`, etc.), matching Postgres/PostgREST directly — this is a deliberate departure from the old Apps Script API's camelCase. `types/api.ts` derives its domain types from the generated `types/supabase.ts` (regenerate via `mcp__supabase__generate_typescript_types` after any schema change, then re-copy into `types/supabase.ts`).
- User creation (`admin.createUser` equivalent) goes through the `create-user` Edge Function (`supabase.functions.invoke('create-user', {...})`), not a direct table insert — it needs the service-role key to call the Auth Admin API, which must never reach the browser.
- `app/globals.css` has **no** `prefers-color-scheme: dark` override — the app is light-themed only (no `dark:` Tailwind variants anywhere).
- Don't declare components inside another component's render body — React remounts them every parent render, silently losing local state/focus. Keep all components at module scope.
- Dynamic route pages (`[matterId]`, `[taskId]`, `[employeeId]`) are client components that unwrap the `params` Promise with React's `use()` (Next.js 16 — `params`/`searchParams` are always promises now).

## FMS workflow (the core feature)

Litigation and Non-Litigation matters share one state machine (`matters.current_step`):

```
DRAFTING_STEP1 -> DRAFTING_STEP2 -> AWAITING_FOUNDER_REVIEW
  -> (REVISING_AFTER_FOUNDER_NOTES -> AWAITING_FOUNDER_REVIEW)*
  -> READY_FOR_CLIENT_SEND -> AWAITING_CLIENT_REVIEW
  -> (REVISING_AFTER_CLIENT_CHANGES -> AWAITING_FOUNDER_REVIEW -> ...)*
  -> READY_FOR_FILING -> AWAITING_FILING_COMPLETION -> COMPLETED
```

- `founder_iteration_counter` is a **matter-lifetime running total**, not per-client-round (see RPC catalog above for the two-function split that enforces this).
- TAT (turnaround time) is business-day/hour aware — skips Sat/Sun and dates in the `holidays` table. There is no global TAT template: TAT is opt-in, set per matter per step type (`STEP1`/`STEP2`/`CLIENT_APPROVAL`/`FILING`) by the admin at matter-creation time via the "New Matter" form's `p_tat` payload, stored in `matter_tat_settings`, and cannot be edited after the matter is created. A step with no TAT configured for it opens with `due_at = null` — it still moves through the state machine normally, it just never has a deadline, is never "overdue," and never accrues overdue-scoring points for that step.
- Notes are **required** (RPC raises `VALIDATION_ERROR`) when requesting changes, both for founder and client decisions — see `matters_founder_decision`/`matters_record_client_decision`.
- Employee-initiated matter transfers and task due-date pushes both require Founder/Admin approval. Approving a transfer also reassigns any currently-open `matter_steps` row to the new owner (`matters_decide_transfer`), so future overdue scoring attributes correctly.

## Approvals — one tab, not scattered

All pending-decision items (founder-review drafts, transfer requests, task push requests) live on a single page: `/admin/approvals`. This was an explicit requirement — **do not** re-introduce separate `/admin/transfers` or `/admin/tasks/push-requests` pages.

## Scoring

Auto-computed, append-only `score_ledger` — never manually edited, totals always aggregated on read (`scoring_get_summary`/direct `score_ledger` reads).

- +1 per founder resubmission (written directly by `matters_submit_to_founder`).
- +1 per working day an item (matter step or independent task) stays overdue past its due date — see `score_overdue_for_ref` in the RPC catalog above.

## Roles

Exactly two: `FOUNDER_ADMIN` and `EMPLOYEE`. No self-signup — every account is created from Admin > Users (via the `create-user` Edge Function) by an existing Founder/Admin, after the one bootstrapped account.

## Decommissioned backend

`backend/backend.gs` and the bound Google Sheet are **no longer live** — fully replaced by the Supabase backend above as a one-time hard cutover (no dual-write, no data migration, since the Sheet only ever held pre-launch/demo data). The Apps Script Web App deployment should be undeployed and the Sheet archived; `backend/` and `docs/DEPLOYMENT.md`'s Apps Script section are kept in the repo for historical reference only — don't extend them, and don't point the frontend back at `NEXT_PUBLIC_APPS_SCRIPT_URL` (removed from `.env.local` in favor of `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`).

## Current state

- Migration to Supabase complete on the backend side: schema, RLS, all RPCs, auth wiring, and the daily cron job are live and smoke-tested end-to-end (full matter lifecycle, RLS boundaries, idempotent scoring all verified against the real project).
- Frontend has been ported to call Supabase directly (`lib/apiClient.ts`, `auth.tsx`, `useEmployees.ts`, `types/api.ts`, `supabaseClient.ts`, and every page under `app/`) — verify `npm run build` passes before treating this as done if you're picking this up mid-stream.
- Restructured so the Next.js app lives at the repo root (not `frontend/`) — this makes Vercel deploys zero-config (no "Root Directory" dashboard setting needed), since Vercel's Next.js builder reads `package.json` from wherever it thinks the project root is, before any custom build command runs. `backend/` and `docs/` remain as non-Next.js sibling directories.
- Git repo pushed to `github.com/mnarborealco-a11y/ERP_FMS`.
- TAT moved from a global template (`tat_settings`, dropped) to opt-in per-matter, per-step config (`matter_tat_settings`, set once via `matters_create`'s `p_tat` param — see "FMS workflow" above). Existing matters created before this change had their due dates stripped for consistency (no per-matter TAT row for them either), and Admin > TAT & Holidays is now just Admin > Holidays.

@AGENTS.md

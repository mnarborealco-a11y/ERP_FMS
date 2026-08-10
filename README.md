# Jlaw Associates - Ops

Internal, cloud-hosted tool for the firm's matter workflow (FMS), court hours tracking, independent task management, and auto-scoring.

- `backend/` - **archived**: the original Google Apps Script Web App (`backend.gs` + `appsscript.json`) this app used before migrating to Supabase. Kept for historical reference only; not deployed.
- (repo root) - Next.js app (TypeScript, App Router), deployed to Vercel, talking directly to Supabase (`@supabase/supabase-js`).
- `docs/DEPLOYMENT.md` - step-by-step deployment instructions (Supabase backend + Vercel frontend), plus the archived Apps Script instructions.

See root `CLAUDE.md` for the full architecture (schema, RLS design, RPC catalog, scoring/TAT algorithms).

## Quick start

1. Stand up the Supabase project - follow **Backend (Supabase)** in `docs/DEPLOYMENT.md`, or connect to the existing project if you already have access.
2. `npm install`, copy `.env.local.example` to `.env.local`, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then `npm run dev`.
3. Log in with the Founder/Admin account you bootstrapped, and create Employee accounts under Admin > Users.

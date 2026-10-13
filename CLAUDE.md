# CLAUDE.md — Kixora working agreement for Claude

This file is the contract for any Claude session working on Kixora. It is always
in effect. Phase-specific additions live in
`docs/PRODUCTION_READY_WORKFLOW.md`.

## What Kixora is

A South African authenticated-sneaker storefront and admin hub.

- **Frontend:** React 18 + Vite 6 + TypeScript + Tailwind 3 (`src/`)
- **Server:** Express 5 (`server.ts`), bundled with esbuild to `dist/server.cjs`
- **Backend:** Supabase — Postgres, Auth, Storage, Realtime (`supabase/migrations/`)
- **Deploy:** Render (web service). **Database/storage:** Supabase.
- **Payments:** PayFast. **Carrier:** The Courier Guy. **Email:** Resend.
- **Runtime:** Node 22, npm only (never bun).

## Platform (hard rules)

1. Render + Supabase are the only platforms. Never add, restore, or reference
   Google Cloud Run, Artifact Registry, GCP, Cloudflare, Vercel, Netlify,
   Firebase, Gemini, or Google Drive.
2. If a task seems to need a GCP/Cloudflare feature, stop and ask. Do not
   silently reintroduce it from an old doc.
3. `render.yaml` is the source of truth for deploy configuration.

## Build (hard rules)

4. Every `VITE_*` variable is **inlined at build time**. Changing one on Render
   requires a rebuild, not a restart. Never describe them as runtime config.
5. Never weaken the live-data build gate in `scripts/flags.ts`. A production
   build must refuse placeholder Supabase coordinates.
6. `/api/health` is **liveness** (must not depend on Supabase). `/api/ready`
   owns dependency checks. Never merge them.

## Security (hard rules)

7. Nothing sensitive may carry a `VITE_` prefix. `SUPABASE_SERVICE_ROLE_KEY`,
   `PAYFAST_PASSPHRASE`, `RESEND_API_KEY`, `THE_COURIER_GUY_API_KEY` and
   `SHIPPING_WEBHOOK_SECRET` are server-only.
8. Never disable RLS, CSRF, CORS validation, a rate limiter, or a webhook
   signature check — not even temporarily, not even behind a flag.
9. Never widen `CORS_ALLOWED_ORIGINS` and never introduce `*`.
10. Authorization comes from `app_metadata` only. Never `user_metadata`, never
    `localStorage`.
11. Never print, request, echo, or commit a secret. Redact it.

## Providers (hard rules)

12. A simulated provider must be named `Simulated*`, expose `isSimulated = true`,
    and be rejected when `NODE_ENV=production`.
13. Never fabricate payment intents, waybills, tracking events, or rates in a
    production code path. If a provider is unconfigured, fail closed with a clear
    error.
14. Do not add a payment or carrier provider without explicit instruction.

## Database (hard rules)

15. Schema changes are new numbered migrations in `supabase/migrations/`. Never
    edit an applied migration.
16. Every new table: RLS enabled, explicit policies, and Data API grants.
17. Apply to staging before production.

## Honesty (hard rules)

18. Report status from command output, not assumption. If you did not run it,
    say "not verified".
19. Never claim observability that does not exist. If there is no SDK, there is
    no error tracking — say so.
20. Docs that claim "complete" are not evidence. The code is the source of truth.

## Production gate

21. Never deploy to production, run a production migration, or change a
    production secret without explicit confirmation in the current conversation.
22. Never set `VITE_PAYFAST_SANDBOX=true` in production.

## Workflow

- Branch from `develop`; PR into `develop`; `main` is production.
- Never push directly to `main`.
- Smallest viable diff. No unrelated refactors. No new dependencies without
  approval.
- Required verification, run one command per line (Windows PowerShell — never `&&`):

  ```
  npx tsc --noEmit
  npx eslint . --max-warnings 0
  npm run test
  npm run build
  ```

- Show a diff summary and the raw verification output before declaring done.

## When generating prompts for editing agents

Use the template in `docs/PRODUCTION_READY_WORKFLOW.md` Part C. Always include:
explicit in-scope and out-of-scope file lists, the phase constraints, the four
verification commands, and the phase exit gate verbatim. Tell the agent to stop
and ask when ambiguous.

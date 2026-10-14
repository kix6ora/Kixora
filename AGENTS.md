# AGENTS.md — Kixora rules for Cline, GitHub Copilot and Codex

This is the always-on contract for editing agents in this repository. It extends
`.clinerules` and `.github/copilot-instructions.md`; where they overlap, follow
the stricter rule. Phase-specific rules are in
`docs/PRODUCTION_READY_WORKFLOW.md`.

## §Scope

- Work on a branch. PR into `develop`. Never push to `main`.
- Touch only the files in scope for the task. Everything else is out of scope,
  especially migrations that have already been applied.
- Smallest viable diff. No drive-by refactors, renames, or formatting sweeps.
- No new dependencies without explicit approval.
- Never invent files, functions, packages, or APIs. If it is not in the repo,
  it does not exist.
- If something is ambiguous or a test fails, stop and ask. Do not improvise.

## §Style

- Smallest viable diff. Do not touch a file that is not in scope.
- Report only what you ran. No summaries of files you read but did not change.
- No busywork: no extra tests, docs, or refactors the task did not ask for.
- Verify with the four commands below and nothing more. Do not invent gates.
- One corrective action at a time; if blocked, say so in one line and stop.

## §Commands

- Node 22, **npm only — never bun**. Do not run `npm install` or `npm ci` unless
  asked.
- Windows PowerShell: one command per line, never `&&`.
- Before declaring done, run and report raw output, one per line:

  ```
  npx tsc --noEmit
  npx eslint . --max-warnings 0
  npm run test
  npm run build
  ```

## §Platform

- Render (web) + Supabase (Postgres/Auth/Storage/Realtime) are the only
  platforms. Do not add or restore GCP, Cloud Run, Artifact Registry, Cloudflare,
  Vercel, Netlify, Firebase, Gemini, or Google Drive configuration.
- `render.yaml` is the source of truth for deploy config.
- Staging deploys from `develop`; production is manual dispatch with an
  environment approval.

## §Build

- `VITE_*` variables are inlined at **build time**. A change to one requires a
  rebuild, not a restart. Never treat them as runtime config.
- Never weaken the live-data build gate (`scripts/flags.ts`). Never add
  `ALLOW_MOCK_PRODUCTION_BUILD` to CI.
- `/api/health` is liveness and must not depend on Supabase. `/api/ready` owns
  dependency checks. Do not merge them.
- When adding a third-party origin, update `src/config/cspImageSources.ts` **and**
  the CSP directives in `server.ts`. Never add `'unsafe-eval'`.
- Never cache `/api/*` in the service worker.

## §Security

- Never disable RLS, CSRF, CORS validation, a rate limiter, or a webhook
  signature check — not temporarily, not behind a flag.
- Never widen `CORS_ALLOWED_ORIGINS`; never introduce `*`.
- Authorization comes from `app_metadata` only. Never read or write roles from
  `user_metadata` or `localStorage`.
- Never log secrets or full request bodies on auth, payments, or webhook routes.
  Use `logger` with `sanitizeDataForLogging`.
- Webhooks: verify the signature before reading business fields, and stay
  idempotent (`webhookIdempotency`, `0015_webhook_idempotency.sql`).
- Security changes need a failing test first, and an ADR in `docs/adr/` if a
  control must change.

## §Database

- Schema changes are new numbered files in `supabase/migrations/`. Never edit an
  applied migration.
- Every new table needs RLS enabled, explicit policies, and Data API grants.
- Apply migrations to staging before production.
- Follow the `supabase-postgres-best-practices` skill: index foreign keys, avoid
  N+1, paginate, use `EXPLAIN ANALYZE` for slow queries, keep transactions short.

## §Providers

- A simulated provider must be named `Simulated*`, expose `isSimulated = true`,
  and be rejected when `NODE_ENV=production`.
- Never fabricate payment intents, waybills, tracking events, or rates in a
  production path. Fail closed with a clear error instead.
- The mock payment driver must not be reachable in a production bundle.
- Do not add a payment or carrier provider without explicit instruction.

## §Money

- Payments and inventory are money. Every change needs a failure-path test, not
  just a happy-path test.
- Order state transitions must be atomic and idempotent, and must happen on the
  server only. Never mutate order status from the client.
- Never change amount, currency, or order-code validation to make a test pass.
- Never store or log raw card data, signed ITN payloads, or API keys.

## §Honesty

- Report status from command output. If you did not run it, say "not verified".
- Never claim an error was "reported" or "monitored" unless an SDK actually sends
  it and you verified it.
- Docs claiming "complete" are not evidence. The code is the source of truth.
- Show a diff summary before committing.

## §Production gate

- Never deploy to production, run a production migration, or change a production
  secret without explicit confirmation in the current conversation.
- Never set `VITE_PAYFAST_SANDBOX=true` in production.
- After any production change, verify `/api/health` and `/api/ready` and paste
  both responses.

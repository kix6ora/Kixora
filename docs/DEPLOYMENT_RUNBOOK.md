# Kixora Deployment Runbook

**Platform of record:** Render (web service) + Supabase (Postgres/Auth/Storage/Realtime).
There is no Cloud Run, GCP, Artifact Registry or Cloudflare in this stack.
`render.yaml` is the source of truth for deploy configuration.

## Secret management

1. Store runtime secrets in the Render dashboard (per service, per environment) and
   mirror the non-secret build-time values as GitHub Environment variables for CI.
2. Never commit real credentials to source control. `.env.example` lists variable
   names only.
3. Keep separate values for staging and production. Never reuse the same Supabase
   service-role key, PayFast passphrase or webhook secret between environments.
4. Use a **separate Supabase project** for staging and production.
5. `CORS_ALLOWED_ORIGINS` must contain only explicit HTTPS origins, no wildcard,
   no path suffix. `src/config/env.ts` refuses to boot otherwise.

## Required runtime secrets (Render)

Server-only — never prefixed with `VITE_`:

- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYFAST_PASSPHRASE`
- `RESEND_API_KEY`
- `THE_COURIER_GUY_API_KEY`
- `SHIPPING_WEBHOOK_SECRET`
- `SENTRY_DSN` (only meaningful once the Sentry SDK is installed — see Phase 7)

Build-time public values (inlined into the bundle at **build** time):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_PUBLIC_SITE_URL`, `VITE_CUSTOMER_DOMAIN`, `VITE_ADMIN_DOMAIN`
- `VITE_PAYMENT_PROVIDER_MODE`, `VITE_PAYFAST_MERCHANT_ID`, `VITE_PAYFAST_MERCHANT_KEY`, `VITE_PAYFAST_SANDBOX`
- all `VITE_USE_SUPABASE_*` flags

> Changing any `VITE_*` value on Render requires a **rebuild/redeploy**, not a
> restart. They are compiled into the client bundle.

## Deploy flow

### Staging

1. Merge into `develop` (or run the **Deploy (Render)** workflow with target
   `staging`).
2. The workflow asserts the environment contract, calls the Render staging Deploy
   Hook, then polls `/api/health` until `status` is `ok`.
3. Smoke-test `/api/health` and `/api/ready` before treating staging as green.
4. Run the staging smoke suite and confirm the app is reachable from the intended
   public domain.

### Production

1. Require a production environment approval in GitHub Actions.
2. Run the **Deploy (Render)** workflow with target `production` only after staging
   is green.
3. Validate `/api/health` and `/api/ready` immediately after deployment and verify
   the reported commit (`RENDER_GIT_COMMIT`) matches the merge you intended.
4. Monitor logs and error events for the first 30–60 minutes before considering the
   deployment fully stable.

## Rollback

1. In the Render dashboard, redeploy the **previous successful deploy** for the
   service (Deploys → select the last good deploy → Rollback / Redeploy).
2. If the issue is application configuration, revert the environment values and
   trigger a new deploy. Remember `VITE_*` changes require a rebuild.
3. Confirm the previous version is healthy by hitting `/api/health` and `/api/ready`
   and loading the storefront home page.
4. If a migration caused the incident, apply a **new forward migration** that
   reverts the change. Never edit or delete an applied migration.
5. Capture the incident in the release record and keep the failing commit SHA.

## Monitoring and alerting

- Sentry for application error tracking via `SENTRY_DSN` — **only after the SDK is
  installed**. Today the repository has no Sentry SDK, so `SENTRY_DSN` alone does
  not produce error reports.
- Structured JSON logs via `logger`; Render captures the service log stream.
- Synthetic probes against `/api/health` and `/api/ready` at least every 60 seconds.
- Alert on sustained 5xx responses, failed webhook verification, and database
  degradation.

## Production gate

Do not proceed with a production release if any of the following are true:

- `CORS_ALLOWED_ORIGINS` is empty or contains `*`
- `CUSTOMER_ORIGIN` and `ADMIN_ORIGIN` are not distinct HTTPS origins
- production secrets are missing from the environment
- any `VITE_USE_SUPABASE_*` flag is not `true`
- `VITE_PAYMENT_PROVIDER_MODE` is not `payfast`, or `VITE_PAYFAST_SANDBOX` is `true`
- `/api/health` fails or `/api/ready` returns `not_ready`
- webhook verification fails in staging or production
- `npm audit --audit-level=high` reports a high or critical finding

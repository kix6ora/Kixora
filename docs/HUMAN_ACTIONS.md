# Kixora — Manual actions required (human-only)

Everything an agent **cannot** do from the repository. Grouped by where you do it,
with the exact values and the code that consumes them. Nothing here is done by
Cline; each item is yours.

Legend: 🔴 do first · 🟠 launch blocker · 🟡 before scaling.

Sources of truth: `render.yaml` (deploy contract), `.env.example` (variable names),
`.github/workflows/deploy-render.yml` (CI secrets), `docs/PRODUCTION_READINESS_TASKS.md`
(the full task list).

---

## 1. Rotate exposed credentials (🔴 first)

| # | Action | Why |
|---|---|---|
| 1.1 | Revoke/rotate the Firebase API key that was committed in `firebase-applet-config.json`. | The file is deleted on `develop`, but the key is still in git history. Deleting the file does not revoke it. |
| 1.2 | If any `PAYFAST_*`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` or `THE_COURIER_GUY_API_KEY` value was ever committed or shared in a doc, rotate it. | Treat all previously exposed secrets as burned. |

## 2. Repository & branches (GitHub)

| # | Action | Detail |
|---|---|---|
| 2.1 | 🟠 Merge `develop` → `main` via a reviewed PR. | `main` @ `e4c973a` is ~5,094 insertions behind `develop` @ `96b2033`. CI must be green first. |
| 2.2 | Verify then delete merged stale branches. | `fix/audit-gate-prod-only`, `fix/ci-green`, `fix/guest-merge-uuid`, `fix/p0-launch-blockers`, `fix/phase1-render-pipeline`, `fix/phase2-security-hardening`, `fix/phase3-closeout`, `fix/phase4a-health-liveness`, `fix/phase4b-service-worker`, `fix/rate-limit-exempt-health`, `fix/staging-blockers`, `staging/payfast-checkout`. **`cline/21kqtaq0` is unmerged — review before deleting.** |
| 2.3 | Protect `main`: require PR + green `test-and-build`, block direct pushes. | The workflow assumes this. |

## 3. Render

| # | Action | Detail |
|---|---|---|
| 3.1 | 🟠 Create the Blueprint from `render.yaml`. | Creates `kixora-web` (branch `main`), `kixora-staging` (branch `develop`) and `kixora-admin-staging` (branch `develop`). |
| 3.2 | 🟠 Attach custom domains. | `kixora.com` + `www.kixora.com` (customer), `admin.kixora.com` (admin). Copy Render's DNS targets into your registrar. |
| 3.3 | 🟠 Set every `sync: false` env var in the Render dashboard. | See §3.1 list below. Values never go in the repo. |
| 3.4 | 🟠 Confirm `numInstances: 1` per service. | Rate limits are per-instance; see `docs/adr/0002-rate-limit-store.md`. Do not scale out without a shared store. |
| 3.5 | 🟠 Set `VITE_PAYFAST_SANDBOX=false` in production only. | Staging stays `true`. |
| 3.6 | ⚠️ Remember: `VITE_*` values are **build-time**. | Changing one requires a **rebuild/redeploy**, not a restart. |

### 3.1 Render env vars to populate (`sync: false`)

**Build-time (public):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_PAYFAST_MERCHANT_ID`, `VITE_PAYFAST_MERCHANT_KEY`, and on staging
`VITE_PUBLIC_SITE_URL` / `VITE_CUSTOMER_DOMAIN` / `VITE_ADMIN_DOMAIN`.

**Server-only secrets (never prefix with `VITE_`):** `SUPABASE_SERVICE_ROLE_KEY`,
`PAYFAST_PASSPHRASE`, `RESEND_API_KEY`, `THE_COURIER_GUY_API_KEY`,
`SHIPPING_WEBHOOK_SECRET`, `SENTRY_DSN`, `CUSTOMER_ORIGIN`, `ADMIN_ORIGIN`,
`CORS_ALLOWED_ORIGINS`.

`CORS_ALLOWED_ORIGINS` must contain **both** exact origins, comma-separated, e.g.
`https://kixora.com,https://www.kixora.com,https://admin.kixora.com`. The server
fails closed otherwise (`src/config/env.ts`).

## 4. GitHub secrets & variables (for `deploy-render.yml`)

| Kind | Name | Purpose |
|---|---|---|
| Secret | `RENDER_DEPLOY_HOOK_STAGING_CUSTOMER` | Trigger the customer staging deploy. |
| Secret | `RENDER_DEPLOY_HOOK_STAGING_ADMIN` | Trigger the admin staging deploy. |
| Secret | `RENDER_DEPLOY_HOOK_PRODUCTION_CUSTOMER` | Trigger the production deploy. |
| Variable | `RENDER_PRODUCTION_CUSTOMER_HEALTH_URL` | Production `/api/health` URL for commit-SHA verification. |
| Secret | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET` | Only if Cloudinary media is retained. |

Create a GitHub **Environment** named `production` with required reviewers so the
production job needs approval.

## 5. Delete the dead GCP secrets (🟡 cleanup)

Remove these GitHub secrets: `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT_KEY`,
`CLOUD_RUN_REGION`, `CLOUD_RUN_SERVICE_STAGING`, `CLOUD_RUN_SERVICE_PRODUCTION`,
`ARTIFACT_REGISTRY_REPOSITORY`. Cloud Run is no longer used.

## 6. Supabase

| # | Action | Detail |
|---|---|---|
| 6.1 | 🟠 Provision two projects: `kixora-staging` and `kixora-prod`. | Region closest to users (`af-south-1` if available). Separate `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` per project. |
| 6.2 | 🟠 Apply all 37 migrations to staging, then production. | `npx supabase link --project-ref <ref>` then `npx supabase db push`. Then `npx supabase db lint`. |
| 6.3 | 🟠 Verify the Data API grants on a **brand-new** project. | Migrations `0030`/`0031` exist because Supabase requires explicit grants. Test once with a fresh project. |
| 6.4 | 🟠 Set the admin role via `app_metadata` only. | Use the `0012_auth_role_sync.sql` path. Never `user_metadata`. |
| 6.5 | 🟠 Enable Realtime for the subscribed tables. | Confirm RLS scopes rows to the owner. |
| 6.6 | 🟡 Migrate media to Supabase Storage, or pin the Cloudinary cloud name. | Buckets come from `0024_storage_setup.sql`. Update `src/config/cspImageSources.ts` + the CSP in `server.ts` if the origin changes. |

## 7. Observability (Sentry)

| # | Action | Detail |
|---|---|---|
| 7.1 | 🟠 Create a Sentry project and set `SENTRY_DSN` on the Render services. | Server reads `SENTRY_DSN`; the browser reads `VITE_SENTRY_DSN`. Until this is set, `sentryEnabled` is `false` and no events are sent. |
| 7.2 | 🟠 Throw a deliberate error in staging and confirm it appears within 60s. | This is the only unproven part of T1. |
| 7.3 | 🟡 Add external uptime probes. | `/api/health` every 60s from two regions; alert on 3 consecutive failures. Add a second probe on `/api/ready`. |

## 8. External providers

| # | Action | Detail |
|---|---|---|
| 8.1 | 🟠 PayFast: sandbox then live credentials. | `VITE_PAYFAST_MERCHANT_ID`, `VITE_PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`. Set the ITN URL to `https://<customer-origin>/api/webhooks/payfast`. |
| 8.2 | 🟠 Resend: verify the sending domain (SPF, DKIM, DMARC). | Set `RESEND_API_KEY` and `EMAIL_FROM`. Confirm a confirmation email lands in the inbox, not spam. |
| 8.3 | 🟠 The Courier Guy: provide `THE_COURIER_GUY_API_KEY`, or accept the deferral. | The real carrier API is not implemented. Production currently fails closed for labels/tracking and returns a flat-rate estimate for quotes (`src/services/shipping/flatRate.ts`). Record the decision in the go/no-go doc. |
| 8.4 | 🟠 Set `SHIPPING_WEBHOOK_SECRET`. | Required for the carrier tracking webhook HMAC. |

## 9. DNS

| # | Action | Detail |
|---|---|---|
| 9.1 | 🟠 Point `kixora.com` and `admin.kixora.com` at Render. | Render issues and renews TLS automatically. |
| 9.2 | 🟠 Do not put a CDN/proxy in front without an ADR. | It changes the client IP that rate limiting and logging see. |
| 9.3 | 🟠 Confirm `CUSTOMER_ORIGIN`, `ADMIN_ORIGIN` and `CORS_ALLOWED_ORIGINS` match the live DNS names exactly. | The server refuses to boot otherwise. |

## 10. Post-deploy verification (🟠)

```
GET /api/health            -> 200 {"status":"ok",...}
GET /api/ready             -> 200 {"status":"ready",...}   (503 while Supabase is unreachable)
GET /                     -> 200
GET /api/csrf             -> 200 {"csrfToken":...} + Set-Cookie: csrf_secret
POST bad PayFast ITN      -> rejected, no state change
POST /api/payments/* with no csrf-token -> 403 {"error":"Invalid CSRF token"}
Admin route with customer token -> 403
Storefront renders live catalog (change a title in SQL, refresh)
```

Then write `docs/production-evidence/go-no-go.md` with a pass/fail and an
evidence link for every line above. No item may be "assumed".

## 11. Final checklist

- [ ] 1.1 Firebase key rotated
- [ ] 2.1 `develop` merged to `main` by PR
- [ ] 3.1–3.6 Render Blueprint + domains + env vars + `numInstances: 1`
- [ ] 4 GitHub secrets + `production` environment with reviewers
- [ ] 5 GCP secrets deleted
- [ ] 6.1–6.5 Supabase projects, migrations, grants, admin role, Realtime
- [ ] 7.1–7.2 Sentry DSN set and one live event confirmed
- [ ] 8.1–8.4 PayFast, Resend, carrier, webhook secret
- [ ] 9.1–9.3 DNS + TLS + matching origins
- [ ] 10 smoke tests + go/no-go record


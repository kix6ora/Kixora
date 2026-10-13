# Kixora — Removal Checklist: Cloud Run / GCP + Dead Drivers

**Audience:** you + Cline / Claude / Copilot / Codex
**Target stack:** Render (web service) + Supabase (Postgres, Auth, Storage, Realtime)
**Baseline reviewed:** `main` (`e4c973a`) and `origin/develop` (`592c451`)
**Rule:** this is a *deletion* plan. Every item below is something the repo still
carries that belongs to a stack you are no longer using. Delete or rewrite it —
do not leave it as a "future option", because dead deploy config is how a
production build silently ships against the wrong platform.

---

## 0. Why this matters

The repository is **half-migrated**. The runtime already assumes Render
(`RENDER_GIT_COMMIT` in `src/lib/healthCheck.ts`, `*.onrender.com` in
`scripts/staging/*.mjs`), but the deploy pipeline, the env contract and several
runbooks still assume **Google Cloud Run + Artifact Registry + Cloudflare**.

If you leave both in place:

- CI will keep trying to authenticate to GCP and fail (or worse, succeed and
  deploy to a platform nobody is watching).
- `.env.example` will keep telling every agent and every new environment to set
  `CLOUD_RUN_*`, and the app will appear "configured" while Render gets nothing.
- Agents will read `docs/DEPLOYMENT_RUNBOOK.md`, see Stripe/ShipLogic/Cloud Run,
  and reintroduce them.

---

## 1. Cloud Run / GCP / Artifact Registry — DELETE

| # | Path | What to do | Why |
|---|---|---|---|
| 1.1 | `.github/workflows/deploy-staging.yml` | **Delete the file.** Replace with a Render deploy hook workflow (§4). | Entire job is `google-github-actions/auth` + `gcloud run deploy`. Also has a duplicated "Stop local Supabase" step (lines 124-138) — a copy/paste bug. |
| 1.2 | `.github/workflows/deploy-production.yml` | **Delete the file.** Replace with a Render production deploy workflow (§4). | Same GCP coupling; `--allow-unauthenticated`, `gcr.io/...` image tags, `CLOUD_RUN_*` secrets. |
| 1.3 | `scripts/verify-deploy-env.mjs` | **Delete the file** and remove `node scripts/verify-deploy-env.mjs` from any workflow. | It exists only to assert `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT_KEY`, `CLOUD_RUN_REGION`, `CLOUD_RUN_SERVICE_STAGING`. Replace with a Render-aware env assertion (§4.3). |
| 1.4 | `.env.example` | Remove `CLOUD_RUN_PROJECT_ID`, `CLOUD_RUN_REGION`, `CLOUD_RUN_SERVICE_STAGING`, `CLOUD_RUN_SERVICE_PRODUCTION`, `ARTIFACT_REGISTRY_REPOSITORY`. Add the Render variables in §4.4. | These five lines are the single biggest source of "which platform am I on?" confusion. |
| 1.5 | `docs/DEPLOYMENT_RUNBOOK.md` | Rewrite. Remove `GCP_SERVICE_ACCOUNT_KEY`, "Google Secret Manager", all "Cloud Run" wording, and the dead secrets `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SHIPLOGIC_API_KEY`. | Stripe and ShipLogic are **not** in the codebase — they are stale driver references. |
| 1.6 | `PRODUCTION_LAUNCH.md` | Rewrite §3 (DNS), §4 (cutover) and §6 (rollback). Remove the Cloudflare CDN diagram, the `199.36.158.100` (Google Load Balancer) A-record, and "Revert Cloud Run service traffic to previous revision". | Render gives you `*.onrender.com` + custom domains; there is no Cloud Run revision to roll back. |
| 1.7 | `docs/STAGING_SETUP_GUIDE.md` | Remove the `gcloud` references and the "Build Docker Image" section; replace with Render staging service + Supabase project setup. | Guide currently teaches a platform you are leaving. |
| 1.8 | `docs/PRODUCTION_PHASES.md` | Remove the Cloudflare/"Cloud Run" lines (Phase 8/10). Also fix the wrong repo URL (`Mandlakaise-Qhomane/Kixora`) and the stale branch name (`remediation/production-launch`). | This file is read by agents as a plan; wrong repo + wrong platform = wrong actions. |
| 1.9 | `PRODUCTION_READINESS_AUDIT.md` | Keep the findings, but add a header noting the platform is Render + Supabase and that Cloud Run references are historical. | Otherwise it re-anchors agents to GCP. |

**Do NOT delete the `Dockerfile`.** Render can build from a Dockerfile, and this
one is correct (multi-stage, non-root user, `EXPOSE 3000`, `CMD node dist/server.cjs`).
You may instead switch to Render's native Node runtime — see §4.2.


---

## 2. Google AI Studio / Gemini / Firebase leftovers — DELETE

These came from the original AI Studio scaffold. They are not part of your stack
and one of them contains a **live-looking credential**.

| # | Path | Status | Action |
|---|---|---|---|
| 2.1 | `firebase-applet-config.json` | **Present on `main`; deleted on `develop`.** Contains a real Firebase `apiKey`, `appId`, `oAuthClientId`. | Delete on every branch. **Rotate/revoke that Google API key** — it is committed in git history, so deleting the file is not enough. |
| 2.2 | `metadata.json` | Present on `main`; deleted on `develop`. Declares `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`. | Delete. |
| 2.3 | `GEMINI_API_KEY` in `.env.example` | Present. | Delete the variable. Nothing in `src/` calls Gemini. |
| 2.4 | `skills-lock.json` | Present on `main`; deleted on `develop`. | Delete (AI Studio artifact). |
| 2.5 | `kixora-staging-blockers.patch` | Present on `main`; deleted on `develop`. 39 KB patch referencing `GEMINI_API_KEY`. | Delete. Patches in the repo root get applied by agents by accident. |
| 2.6 | `src/hooks/useGoogleAuth.ts` | Deleted on `develop`. | Confirm it stays deleted. |
| 2.7 | `src/services/googleDriveService.ts` | Deleted on `develop`. | Confirm it stays deleted. |
| 2.8 | `src/config/cspImageSources.ts` | `develop` removed a Firebase origin. | Verify no `firebase`/`googleapis` origin remains. |

---

## 3. Drivers — remove, replace, or make honest

A "driver" here is any module that talks to an external provider behind a
`providerId`. Kixora has three driver families plus two platform leftovers.

### 3.1 `src/services/payments/mockDriver.ts` — REMOVE FROM PRODUCTION BUNDLE

- `MockPaymentDriver` fabricates `pi_mock_*` intents and always succeeds.
- **Good news:** `getPaymentDriver()` / `getActivePaymentDriver()` in
  `src/services/payments/index.ts` already throw when
  `NODE_ENV === 'production'` and the provider is `mock`, and
  `isPaymentConfigured()` in `src/config/env.ts` throws for a mock provider in a
  production build.
- **Still to do:** those guards are runtime. Make the *bundler* drop it:
  register the mock driver only when `!import.meta.env.PROD` (dynamic
  `import()`), so `mockDriver.ts` never lands in `dist/assets/*.js`.
  Keep the module for tests. It is legitimate test infrastructure; it is not
  legitimate production code.

### 3.2 `src/services/shipping/carrierDrivers.ts` — FAKE LIVE DRIVER, FIX OR LABEL

`TheCourierGuyDriver` **claims** to be a live integration but every method is
simulated:

- `calculateRates()` returns hard-coded ZAR numbers chosen by regex-matching the
  destination string. No HTTP call.
- `generateLabel()` fabricates `TCG-<random 8 digits>` waybills and a
  `labels.thecourierguy.co.za` URL that does not exist.
- `getTracking()` returns two invented events with `Date.now()` timestamps.
- `parseWebhook()` only reshapes whatever JSON arrives; no signature check.

**Action (choose one, and be explicit in the code):**

1. **Real integration (preferred for launch):** implement `calculateRates` /
   `generateLabel` / `getTracking` against `https://api.thecourierguy.co.za/v1`
   with `THE_COURIER_GUY_API_KEY`, and verify webhook HMAC with
   `SHIPPING_WEBHOOK_SECRET` (the secret already exists in `ServerEnvConfig`).
2. **Honest stub (staging only):** rename the class `SimulatedCourierGuyDriver`,
   add `readonly isSimulated = true`, and have `shippingService` **fail closed**
   in production when the carrier is simulated — exactly the way payments fail
   closed on `mock`.

Either way: `docs/DEPLOYMENT_RUNBOOK.md` and `PRODUCTION_LAUNCH.md` already admit
the carrier driver is simulated. Delete those admissions only when the code stops
being simulated.

### 3.3 `src/services/payments/payfastDriver.ts` — KEEP, FINISH

Not a dead driver, but two methods are stubs that return failure:

- `createPaymentIntent()` → `PAYFAST_SERVER_INITIATION_REQUIRED` (correct design:
  the server initiates; see `src/services/payments/payfastCheckout.ts`).
- `processRefund()` → "PayFast refunds require an authenticated provider refund workflow".

Keep the driver. Either implement refunds via the PayFast API or surface "refunds
are manual" in the admin UI so nobody assumes a button works.

### 3.4 Cloudinary — MIGRATE TO SUPABASE STORAGE

- `src/lib/cloudinary.ts`, `src/services/storageService.ts`,
  `@cloudinary/react`, `@cloudinary/url-gen`, `VITE_CLOUDINARY_*`.
- You already have `supabase/migrations/0024_storage_setup.sql` (buckets + RLS).
  Supabase Storage + its CDN covers product images, drop media and customizer
  textures.
- **Why remove it:** a third-party image host is a second set of credentials, a
  second billing relationship, and a second CSP `img-src` origin — for a
  capability Supabase already gives you.
- **If you keep Cloudinary:** pin `VITE_CLOUDINARY_CLOUD_NAME` in every
  environment (`docs/PRODUCTION_PHASES.md` already warns assets 404 because the
  code assumes cloud name `kixora` while `.env.example` says `vevnhwj6`).

### 3.5 Dead provider names in docs — DELETE

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (in `docs/DEPLOYMENT_RUNBOOK.md`)
- `SHIPLOGIC_API_KEY` (same file)
- `Stripe` string in `src/data/sneakers.ts` — check whether it is seed copy; if
  it is a leftover integration reference, remove it.

### 3.6 Platform leftovers — DELETE

- `bun.lock` — the project is npm-only (`.clinerules` says "npm only (never
  bun)") and `package-lock.json` is the real lockfile. Having both makes agents
  pick the wrong package manager.
- `.env.example` `VITE_CLOUDINARY_API_KEY` — an API *key* (not a preset) must
  never be a `VITE_` variable. If unused, delete it.

---

## 4. What REPLACES the deleted Cloud Run pieces

### 4.1 `render.yaml` (new file — added alongside this doc)

A Render Blueprint describing the customer web service, the admin web service,
the health check path and the build/start commands. See `/render.yaml`.

### 4.2 Build & start commands for Render (native Node runtime)

```yaml
buildCommand: npm ci && npm run build
startCommand: node dist/server.cjs
healthCheckPath: /api/health
```

Add to `package.json` so Render can pin the runtime:

```json
"engines": { "node": ">=22 <23" }
```

The server already reads `process.env.PORT`, binds `0.0.0.0`, and sets
`app.set('trust proxy', 1)` — all three are Render requirements and already
satisfied.

### 4.3 Render-aware deploy env check (replaces `scripts/verify-deploy-env.mjs`)

Assert the *application* contract, not a cloud vendor:

- `NODE_ENV=production`
- `CUSTOMER_ORIGIN`, `ADMIN_ORIGIN`, `CORS_ALLOWED_ORIGINS` (both origins present)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, all 7 core `VITE_USE_SUPABASE_*` = `true`
- `SUPABASE_SERVICE_ROLE_KEY`, `PAYFAST_PASSPHRASE`, `RESEND_API_KEY`
- Render supplies `RENDER_GIT_COMMIT` / `RENDER_SERVICE_NAME` — log them, do not
  require them.

### 4.4 Render environment variables (replaces `CLOUD_RUN_*`)

| Variable | Service | Notes |
|---|---|---|
| `NODE_ENV` | both | `production` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | both | **build-time** — baked into the bundle |
| `VITE_USE_SUPABASE_*` (all 7 core) | both | must be `true` or the live-data build gate refuses the build |
| `VITE_PAYMENT_PROVIDER_MODE` | both | `payfast` |
| `VITE_PAYFAST_MERCHANT_ID` / `_KEY` | both | |
| `VITE_PAYFAST_SANDBOX` | staging `true`, prod `false` | |
| `VITE_PUBLIC_SITE_URL` | both | HTTPS origin, no path (validated in `src/config/env.ts`) |
| `VITE_CUSTOMER_DOMAIN` / `VITE_ADMIN_DOMAIN` | both | must match `CUSTOMER_ORIGIN` / `ADMIN_ORIGIN` |
| `SUPABASE_SERVICE_ROLE_KEY` | both | **server only, never `VITE_`** |
| `PAYFAST_PASSPHRASE` | both | server only |
| `RESEND_API_KEY`, `EMAIL_FROM` | both | server only |
| `THE_COURIER_GUY_API_KEY`, `SHIPPING_WEBHOOK_SECRET` | both | server only |
| `CUSTOMER_ORIGIN`, `ADMIN_ORIGIN`, `CORS_ALLOWED_ORIGINS` | both | explicit, no `*` |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT` | both | only after you add the real SDK (Phase 7) |

### 4.5 Render deploy workflow (replaces the two GCP workflows)

One workflow, two jobs (staging on `develop`, production on manual dispatch with
a GitHub Environment approval), each calling a Render **Deploy Hook** URL stored
as a secret, then polling `/api/health` until `status != degraded`.

Delete from GitHub secrets: `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT_KEY`,
`CLOUD_RUN_REGION`, `CLOUD_RUN_SERVICE_STAGING`, `CLOUD_RUN_SERVICE_PRODUCTION`,
`ARTIFACT_REGISTRY_REPOSITORY`.

Keep: `PLAYWRIGHT_*`, `SUPABASE_ANON_KEY`, `STAGING_*`, `CLOUDINARY_*` (only if
you keep Cloudinary).

---

## 5. Verification (do not skip)

After deleting, run this and paste the output into your PR:

```bash
# 1. Nothing in the repo still points at GCP/Cloud Run.
git grep -inE 'cloud_run|cloud run|gcloud|gcr\.io|artifact_registry|africa-southeast1|google-github-actions' -- . ':!docs/*' || echo "CLEAN"

# 2. Nothing still references dead providers.
git grep -inE 'stripe|shiplogic|gemini|firebase|googledrive' -- . ':!docs/*' ':!package-lock.json' ':!bun.lock' || echo "CLEAN"

# 3. The build gate still passes with real live-data flags.
npx tsc --noEmit
npx eslint . --max-warnings 0
npm run test
npm run build
```

**Exit gate:** commands 1 and 2 print `CLEAN`, and the four verification
commands pass with `NODE_ENV=production` and real Supabase values present.


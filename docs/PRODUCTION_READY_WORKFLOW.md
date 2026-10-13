# Kixora — Production Readiness Workflow (Render + Supabase)

**Owner:** you
**Stack of record:** React 18 + Vite 6 + TypeScript + Tailwind 3, Express 5
(`server.ts` → `dist/server.cjs`), Supabase (Postgres/Auth/Storage/Realtime),
deployed on **Render**, database and storage on **Supabase**.
**Branches reviewed:** `main` @ `e4c973a`, `origin/develop` @ `592c451`
**How to use this doc:** run the phases in order. Each phase has *Steps*,
*Deliverables*, an *Exit gate* (evidence, not vibes), and *Agent rules* you paste
into Claude / Cline / Copilot / Codex for that phase. Standing rules live in
`CLAUDE.md` and `AGENTS.md` at the repo root.

> **Progress:** ✅ **Phase 0 and Phase 1 are complete in the repo** — see
> `docs/PHASE0_1_EXECUTION_REPORT.md` for the itemised evidence and the list of
> human actions still required (Render services, domains, secrets, GCP secret
> deletion, Firebase key rotation). Next phase: **Phase 2 — Supabase as the
> single source of truth.**

---

## Part A — Architecture review (what you actually have)

### A.1 Shape of the system

```
Browser (React SPA)
  ├── src/config/features.ts        VITE_USE_SUPABASE_* feature flags
  ├── src/lib/supabase.ts           anon-key client (RLS enforced)
  ├── src/repositories/customer/*   DAL: catalog, cart, wishlist, orders
  ├── src/repositories/admin/*      DAL: catalog, orders, inventory, promos, audit
  └── src/services/*                auth, analytics, monitoring, storage

Express server (server.ts)
  ├── helmet CSP, CORS allowlist, rate limits, csurf
  ├── /api/health, /api/ready
  ├── /api/payments/payfast/initiate + /api/webhooks/payfast
  ├── /api/shipping/rates, /api/shipping/labels, /api/webhooks/tracking
  ├── /api/notifications/email/order-confirmation
  └── src/lib/supabaseAdmin.ts      service-role client (server only)

Supabase
  ├── 33 SQL migrations (schema, RLS, storage, realtime, hardening)
  ├── seed/ 01_catalog.sql, 02_staging_demo_orders.sql
  └── Auth with role in app_metadata (src/utils/roleUtils.ts)
```

### A.2 What is genuinely strong (keep it, do not "improve" it)

1. **Layered DAL.** Repositories are separated from components; mappers exist
   (`productMapper.ts`, `orderMapper.ts`, `promoAdminMapper.ts`). Do not let an
   agent collapse this into components.
2. **Fail-closed production guards.** `src/config/env.ts` throws when payment
   mode is `mock` in production; `getPaymentDriver` throws for `mock`; the
   develop-only `scripts/flags.ts` refuses a production build against placeholder
   Supabase coordinates. This is the single best property of the repo.
3. **Two-key Supabase split.** `src/lib/supabase.ts` (anon) vs
   `src/lib/supabaseAdmin.ts` (service role, server only, `autoRefreshToken:
   false`). Correct.
4. **Role from `app_metadata` only.** `src/utils/roleUtils.ts` explicitly ignores
   `user_metadata` — the most common Supabase privilege-escalation mistake,
   already avoided.
5. **Server-side money movement.** `createPaymentIntent()` deliberately refuses to
   build a PayFast request client-side; checkout is initiated in
   `src/services/payments/payfastCheckout.ts` on the server.
6. **Real RLS depth.** `0022_storage_setup.sql`, `0023_rls_hardening.sql`,
   `0025_rls_hardening.sql`, `0030_service_role_grants_and_rls_baseline.sql`,
   `0031_explicit_data_api_grants.sql`, plus `0033_admin_audit_access.sql`
   revoking direct `SELECT` on `admin_audit_logs` in favour of an admin-checked
   RPC.
7. **Body limits already fixed on `develop`.** `express.json({ limit: '10kb' })`
   — the old 50 MB global limit is gone. Webhooks use their own 10 MB
   raw/urlencoded parsers *before* the JSON parser. Correct ordering.
8. **Structured logger + request IDs.** `logger.ts` emits JSON in production and
   sanitises context via `sanitizeDataForLogging`.
9. **Real release gate.** `scripts/release-gate.mjs` resolves every suite to
   concrete `*.spec.ts` files and aborts if a suite matches nothing — so a suite
   can never be silently skipped. Excellent pattern; keep it.
10. **CI runs migrations against a real local Supabase** with
    `REQUIRE_SUPABASE=true`, so a missing DB is a failure, not a skip.

### A.3 Critical findings (these are your launch blockers)

| ID | Severity | Finding | Where |
|---|---|---|---|
| C1 | **Critical** | Two deployment platforms in one repo. Cloud Run workflows + GCP secrets coexist with Render URLs. | `.github/workflows/deploy-*.yml`, `.env.example`, `docs/*` |
| C2 | **Critical** | `firebase-applet-config.json` ships a real Firebase API key in git history. | repo root (`main`) |
| C3 | **Critical** | Carrier "integration" is simulated but named as if live: hard-coded rates, random waybills, invented tracking events. | `src/services/shipping/carrierDrivers.ts` |
| C4 | **Critical** | Sentry is configured (`SENTRY_DSN`) but there is **no Sentry SDK** in `package.json`; `monitoringService` POSTs JSON at the DSN URL, which is not an ingestion endpoint. You have no error tracking today. | `src/services/monitoringService.ts`, `package.json` |
| C5 | **High** | PWA service worker is cache-first for *every* GET including navigations, with a static `kixora-shell-v1` cache name. Users get a stale shell after a deploy. | `public/sw.js` |
| C6 | **High** | CSP still allows `'unsafe-inline'` and `'unsafe-eval'` in `script-src` in production. | `server.ts` L90 |
| C7 | **High** | `csurf` is archived/unmaintained and is wired for `/api/payments`, `/api/shipping`, `/api/notifications`. | `server.ts`, `package.json` |
| C8 | **High** | Admin isolation depends on hostname comparison against `VITE_ADMIN_DOMAIN`; on Render you must actually provision two distinct origins or the guard is decorative. | `src/routes/DomainGuard.tsx` |
| C9 | **High** | Rate limiting uses the default in-memory store. With more than one Render instance the limit is per-instance, not global. | `server.ts` (~L230) |
| C10 | **Medium** | Tests are predominantly mock-mode. They prove the app fails safe, not that it works against live Supabase/PayFast. | `tests/*` |
| C11 | **Medium** | `bun.lock` + `package-lock.json` both present; `.clinerules` says npm only. | repo root |
| C12 | **Medium** | Health check returns **503** when Supabase is unhealthy. Render restarts unhealthy instances, so a transient Supabase blip can become a restart loop. Split liveness (`/api/health`) from readiness (`/api/ready`). | `src/lib/healthCheck.ts` |
| C13 | **Medium** | `VITE_CLOUDINARY_CLOUD_NAME` mismatch (`kixora` in code vs `vevnhwj6` in `.env.example`) → 404 images. | `src/lib/cloudinary.ts` vs `.env.example` |
| C14 | **Medium** | No `render.yaml`, no `engines` field, no Render deploy workflow. | repo root |
| C15 | **Low** | `docs/PRODUCTION_PHASES.md` names the wrong repo and a branch that does not exist. | `docs/PRODUCTION_PHASES.md` |
| C16 | **Low** | Duplicated `playwright-report/` entry in `.gitignore`; duplicated "Stop local Supabase" step in `staging.yml`. | `.gitignore`, `.github/workflows/staging.yml` |

### A.4 Stack-fit verdict

The application layer is already Render-shaped: it reads `process.env.PORT`,
binds `0.0.0.0`, sets `trust proxy`, talks to Supabase over HTTPS (PostgREST, so
there is no raw Postgres pool to tune), and exposes `/api/health`. The work is
**not** rewriting the app — it is:

1. deleting the second platform (Cloud Run/GCP),
2. making the fake drivers honest or real,
3. making observability real,
4. proving all of it against live staging.

---

## Part B — The phase workflow

> **Branch model.** `main` = production. `develop` = staging, auto-deployed.
> Every change: feature branch → PR into `develop` → green CI → merge → verify
> staging → promote PR `develop` → `main`. Never commit to `main` directly.
>
> **Definition of done for every phase.** `npx tsc --noEmit`,

### Phase 0 — Baseline, branch discipline, repo hygiene

**Objective:** get one trustworthy baseline so later phases are measurable.

**Steps**
1. Confirm the branch topology: `main` (production), `develop` (staging), plus
   the eight `fix/*` branches on the remote. List them, decide which are merged,
   and delete merged ones (`gh api repos/:owner/:repo/branches`).
2. Merge `develop` into `main` only through a PR, and only after CI is green, so
   `main` and `develop` stop diverging. The diff is ~1,950 added / 542 removed
   lines across 74 files — review it once, properly.
3. Freeze new feature work for the duration of Phases 1–3 (de-platforming and
   driver cleanup). Parallel feature work during a platform migration is how
   secrets leak.
4. Record the baseline: current test count, current `npm run build` output size,
   and `curl -s https://<staging>/api/health`.
5. Delete the dead artifacts listed in `docs/REMOVAL_CLOUDRUN_AND_DRIVERS.md`
   §2 and §3.6 (`bun.lock`, `kixora-staging-blockers.patch`, `skills-lock.json`,
   `metadata.json`, `firebase-applet-config.json`). **Rotate the Firebase key
   first** — it is in git history.
6. Add `"engines": { "node": ">=22 <23" }` to `package.json`.
7. Fix the `.gitignore` duplicate `playwright-report/` line.
8. Add `docs/PRODUCTION_READY_WORKFLOW.md`, `docs/REMOVAL_CLOUDRUN_AND_DRIVERS.md`,
   `CLAUDE.md`, `AGENTS.md`, `render.yaml` to the repo and commit.

**Deliverables:** clean branch list, one merged baseline, dead artifacts removed,
`engines` pinned, new governance docs committed.

**Exit gate:** `git grep -l 'firebase-applet-config\|skills-lock\|bun.lock'` is
empty; `npm ci && npm run build` succeeds on a clean clone.

**Agent rules — paste into Cline / Claude**
```
Phase 0 is deletion and hygiene only. Do not refactor application logic.
Never commit secrets. Before deleting any file, list it and confirm it is not
imported anywhere (`git grep -n "<name>"`). Run one command per line on
Windows PowerShell; never use `&&`.
After each change run, in order: npx tsc --noEmit, npx eslint . --max-warnings 0,
npm run test, npm run build. Report the exact output. Do not run npm install.
Keep the diff minimal and reversible. If a deletion breaks a test, stop and ask
instead of "fixing" the test.
```

---

### Phase 1 — De-platform: remove Cloud Run/GCP, adopt Render

**Objective:** one platform, one pipeline, one env contract.

**Steps**
1. Delete `.github/workflows/deploy-staging.yml` and
   `.github/workflows/deploy-production.yml`.
2. Delete `scripts/verify-deploy-env.mjs` and its call sites.
3. Strip `CLOUD_RUN_*` and `ARTIFACT_REGISTRY_REPOSITORY` from `.env.example`;
   add the Render variable set from `docs/REMOVAL_CLOUDRUN_AND_DRIVERS.md` §4.4.
4. Add `render.yaml` (already added at the repo root by this pack) describing the
   customer web service and the admin web service, both with
   `buildCommand: npm ci && npm run build`,
   `startCommand: node dist/server.cjs`, `healthCheckPath: /api/health`.
5. Create the Render services and attach **separate** custom domains:
   - `kixora.com` (customer)
   - `admin.kixora.com` (admin)
   Then set `CUSTOMER_ORIGIN`, `ADMIN_ORIGIN`, `VITE_CUSTOMER_DOMAIN`,
   `VITE_ADMIN_DOMAIN`, `VITE_PUBLIC_SITE_URL` to exactly those origins.
   `src/config/env.ts` requires HTTPS, no path, no query, and that the two
   origins differ — it will refuse to boot otherwise. Good.
6. Add a Render-aware env assertion (new `scripts/verify-deploy-env.mjs`) that
   checks the *application* contract, not a cloud vendor (see §4.3 of the
   removal doc). Wire it into CI, not into the deploy job.
7. Add one deploy workflow using Render Deploy Hooks + a health poll; staging
   auto-deploys from `develop`, production is `workflow_dispatch` with a GitHub
   Environment approval.
8. Delete the now-unused GitHub secrets for GCP.

**Deliverables:** `render.yaml`, one deploy workflow, Render staging URL
returning 200 on `/api/health`, no GCP references outside historical docs.

**Exit gate:**
```bash
git grep -inE 'cloud_run|cloud run|gcloud|gcr\.io|artifact_registry|africa-southeast1|google-github-actions' -- . ':!docs/*' || echo CLEAN
```
prints `CLEAN`, and both Render services report healthy.

**Agent rules — paste into Cline / Claude**
```
Platform of record is Render. Supabase is the only managed backend.
Never add GCP, Cloud Run, Artifact Registry, Cloudflare, Vercel or Netlify config.
Deployment config is declarative: render.yaml is the source of truth.
Do not add new secrets to .env.example values — only names, never values.
When editing workflows, keep staging on `develop` and production on
workflow_dispatch with an `environment:` approval.
Verify any origin change against src/config/env.ts and src/config/cors.ts before
committing; the server fails closed on a bad origin by design.
```

> `npx eslint . --max-warnings 0`, `npm run test`, `npm run build` all pass, and
> the phase's Exit gate evidence is attached to the PR.


---

### Phase 2 — Supabase as the single source of truth

**Objective:** every environment reads live Supabase data; nothing reads local seed.

**Steps**
1. Provision **two** Supabase projects: `kixora-staging` and `kixora-prod`.
   Region: closest to your users (South Africa → `af-south-1` if available).
2. Apply all 33 migrations to staging first:
   `npx supabase link --project-ref <staging-ref>` then `npx supabase db push`.
   Then run `npx supabase db lint` and the RLS penetration suite
   (`tests/security/phase8-rls-penetration.spec.ts`) against staging.
3. Verify the grant baseline: `0030_service_role_grants_and_rls_baseline.sql` and
   `0031_explicit_data_api_grants.sql` exist because Supabase's Data API now
   requires explicit grants. Confirm a fresh project gets the right grants —
   test with a brand-new project once, not just the linked one.
4. Confirm Realtime is enabled for the tables the storefront subscribes to
   (`0020_realtime_setup.sql`, `0022_realtime_setup.sql`) and that RLS allows the
   anon role to receive only its own rows.
5. Turn on every core flag in both environments:
   `VITE_USE_SUPABASE_CATALOG|DROPS|CART|WISHLIST|ORDERS|CHECKOUT|AUTH=true`.
   `scripts/flags.ts` refuses a production build otherwise — that is the point.
6. Migrate media to Supabase Storage using the buckets from
   `0024_storage_setup.sql`; retire Cloudinary (or pin its cloud name — see
   removal doc §3.4). Update `src/config/cspImageSources.ts` to match the new
   image origins exactly.
7. Set the admin role through `app_metadata` only, using the
   `0012_auth_role_sync.sql` path. Never `user_metadata`.
8. Record the Supabase connection story in `docs/`: you use PostgREST over HTTPS,
   so there is no pooler to configure. If you ever add a direct `pg` client, you
   must use the Supavisor pooler in transaction mode.

**Deliverables:** two projects, migrations applied to staging, RLS proof output,
all flags on, media in Supabase Storage, CSP image origins updated.

**Exit gate:** staging storefront renders catalog data that exists only in
Supabase (prove it by changing a product title in SQL and refreshing);
`tests/security/phase8-rls-penetration.spec.ts` passes against staging.

**Agent rules — paste into Cline / Claude**
```
Supabase is the only backend. Do not introduce another database, ORM, or BaaS.
Schema changes are migrations only: add supabase/migrations/00NN_*.sql, never
edit an applied migration. Migrations must be idempotent-safe and applied to
staging before production.
RLS is mandatory on every new table: enable RLS, add explicit policies, and add
the table to the Data API grants. A table without RLS is a bug.
Never use the service-role key in browser code or any VITE_ variable. It belongs
only in src/lib/supabaseAdmin.ts consumers.
Roles come from app_metadata. Never read or write authorization from
user_metadata or localStorage.
For query work, follow the repo's supabase-postgres-best-practices skill:
index foreign keys, avoid N+1, paginate, use EXPLAIN ANALYZE for slow queries.
```

---

### Phase 3 — Drivers: remove the fakes, finish the real ones

**Objective:** no module in production claims to talk to a provider it does not.

**Steps**
1. **Mock payment driver.** Convert `src/services/payments/index.ts` to register
   `MockPaymentDriver` via a conditional dynamic import so the class is absent
   from the production bundle:
   ```ts
   const drivers: Partial<Record<PaymentProviderType, PaymentGatewayDriver>> = {
     payfast: new PayFastPaymentDriver(),
   };
   if (!import.meta.env.PROD) {
     const { MockPaymentDriver } = await import('./mockDriver');
     drivers.mock = new MockPaymentDriver();
   }
   ```
   Keep the runtime throw in `getPaymentDriver` as defence in depth.
2. **Carrier driver.** Either implement the real The Courier Guy API, or rename
   to `SimulatedCourierGuyDriver` with `readonly isSimulated = true` and make
   `shippingService` fail closed in production when simulated (mirroring the
   payment pattern). Update `PRODUCTION_LAUNCH.md` and
   `docs/DEPLOYMENT_RUNBOOK.md` accordingly — today they document the simulation
   as a known gap, which is honest but not launchable.
3. **PayFast.** Implement or explicitly document refunds. Keep
   `createPaymentIntent()` returning `PAYFAST_SERVER_INITIATION_REQUIRED` — that
   is correct.
4. **Delete dead provider references:** `STRIPE_*`, `SHIPLOGIC_API_KEY`, the
   `Stripe` string in `src/data/sneakers.ts` if it is not seed copy.
5. **Add a driver contract test** for every driver: `isConfigured()` returns
   false without credentials, and the production guard throws for a simulated
   provider under `NODE_ENV=production`.

**Deliverables:** production bundle contains no mock driver; carrier is real or
explicitly simulated and fail-closed; docs match code; new contract tests.

**Exit gate:**
```bash
npm run build
grep -rl "pi_mock_" dist/ || echo "NO MOCK DRIVER IN BUNDLE"
```
prints `NO MOCK DRIVER IN BUNDLE`.

**Agent rules — paste into Cline / Claude**
```
Never leave a simulated provider reachable in a production code path.
Every driver must expose isConfigured(); a driver without credentials must
return a failure, never fabricated success.
Simulated providers must be named Simulated*, expose isSimulated = true, and be
rejected when NODE_ENV=production.
Never invent waybill numbers, tracking events, rates, or payment intents in code
that runs in production.
When you touch a driver, add or update its test in tests/integrations or
tests/unit. Show the failing test first, then the fix.
Do not add a new payment or carrier provider without an explicit instruction.
```


---

### Phase 4 — Build & runtime integrity

**Objective:** the artifact that deploys is provably a live-data artifact, and it
does not serve stale UI.

**Steps**
1. **Live-data build gate.** Keep `scripts/flags.ts` and its `vite.config.ts`
   wiring. Add the CI build-args so the production build job supplies real
   `VITE_USE_SUPABASE_*` and Supabase coordinates. `develop` already does this
   (`ci: pass live-data build args...`) — carry it forward.
2. **Build-time vs runtime variables.** Document loudly that every `VITE_*`
   variable is **inlined at build time**. On Render, changing a `VITE_` variable
   requires a **rebuild/redeploy**, not a restart. Put this in `render.yaml`
   comments and in `CLAUDE.md`.
3. **Service worker.** Rewrite `public/sw.js`:
   - version the cache from the build (inject `RENDER_GIT_COMMIT` or a build hash)
   - network-first (or stale-while-revalidate) for navigations and `/index.html`
   - cache-first only for hashed `/assets/*`
   - never cache `/api/*`
   - add a `skipWaiting` + `clients.claim` message channel so a new deploy can
     activate immediately.
4. **Health vs readiness.** Keep `/api/health` as a *liveness* endpoint that
   returns 200 while the process is alive, and put the Supabase ping on
   `/api/ready` returning 503 when degraded. Otherwise a transient Supabase
   blip makes Render kill and restart a perfectly healthy process (finding C12).
   Point Render's `healthCheckPath` at `/api/health`.
5. **Admin bundle split.** `vite.config.ts` already chunks `admin-hub`. Confirm
   the admin chunk is not loaded on the customer domain (check the network tab
   on `kixora.com`). The admin UI should be a lazy route behind `DomainGuard`.
6. **CSP tightening.** Remove `'unsafe-eval'` first (nothing in the app needs it),
   then remove `'unsafe-inline'` for `script-src` by using nonces or hashes. Keep
   `'unsafe-inline'` for `style-src` only if Tailwind's runtime requires it.
7. **Media/CSP origins.** Ensure `buildCspImageSources`,
   `buildCspConnectSources`, `buildCspWorkerSources` match the real media origin
   and the real Supabase origin. A missing origin shows up as a silent CSP
   violation, not a crash.

**Deliverables:** versioned service worker, split health/readiness, tighter CSP,
CI production build with live-data args.

**Exit gate:** build a production bundle with placeholder Supabase values and
confirm it **fails**; build with real values and confirm `/api/ready` is `ready`
on staging; reload the app after a deploy and confirm no stale shell.

**Agent rules — paste into Cline / Claude**
```
VITE_* variables are build-time. Never treat them as runtime-configurable.
Never weaken the live-data build gate in scripts/flags.ts. Do not add
ALLOW_MOCK_PRODUCTION_BUILD to CI.
/api/health is liveness and must not depend on Supabase. /api/ready owns the
dependency checks. Do not merge them.
Never cache /api/* in the service worker. Bump the cache name from a build
identity, never hand-edit it.
When adding a third-party origin, update src/config/cspImageSources.ts AND the
CSP directives in server.ts. Do not add 'unsafe-eval'.
Do not add a CDN, edge worker, or proxy in front of Render without instruction.
```


---

### Phase 5 — Security hardening verification

**Objective:** prove the boundaries hold, in the live environment.

**Steps**
1. **RLS penetration, live.** Run the RLS suite against the staging Supabase
   project with real customer and admin accounts. Evidence required: customer
   gets `403`/`42501` on `admin_audit_logs` direct select and on the admin RPC;
   admin gets `200`. `scripts/staging/verify-api-roles.mjs` already encodes this
   assertion — run it and keep its JSON output.
2. **CSRF.** `csurf` is archived (finding C7). Decide:
   - short term: keep it, but verify it works with `cookie` mode and the
     `csrf_secret` cookie over HTTPS on Render, and confirm the token endpoint
     `/api/csrf` is reachable cross-origin from the admin domain.
   - target: replace with an `Origin`/`Sec-Fetch-Site` check plus a
     double-submit cookie. Add an ADR (`docs/adr/`) before changing it.
3. **Rate limits.** Move the limiter store to a shared backend (Upstash Redis /
   Supabase table) or accept per-instance limits and document it. With Render
   autoscaling, in-memory limits are per-instance (finding C9). Keep
   `trust proxy` set (already done) so `express-rate-limit` sees the real client
   IP, and keep the checkout limiter aggressive.
4. **Secrets.** Confirm no secret is reachable from the browser: grep the built
   bundle for `SUPABASE_SERVICE_ROLE_KEY`, `PAYFAST_PASSPHRASE`,
   `RESEND_API_KEY`, `THE_COURIER_GUY_API_KEY`, `SHIPPING_WEBHOOK_SECRET`. All
   must be absent.
5. **Headers.** Verify on the live staging URL: HSTS, `X-Content-Type-Options`,
   `X-Frame-Options: DENY`, and `frame-ancestors 'none'` all present and
   consistent.
6. **Webhook signature verification.** Replay a bad PayFast ITN and a bad carrier
   webhook; both must be rejected. `scripts/staging/payfast-itn-replay.mjs`
   supports the PayFast cases (`wrong-signature`, `wrong-amount`, `duplicate`,
   `unknown-order`, `cancelled`).
7. **Dependency audit.** Keep `npm audit --audit-level=high` as a hard CI gate.
   Add Dependabot or Renovate.

**Deliverables:** live RLS evidence, CSRF decision recorded, rate-limit decision
recorded, bundle secret scan clean, header evidence, webhook rejection evidence.

**Exit gate:** `scripts/staging/verify-api-roles.mjs` exits 0 against staging and
its JSON is attached to the PR; the built bundle contains zero secret values.

**Agent rules — paste into Cline / Claude**
```
Security changes require a failing test first. Never "temporarily" disable RLS,
CORS validation, CSRF, or a rate limiter — not even behind a flag.
Never log secrets. Use logger with sanitizeDataForLogging; never console.log a
request body on a payments, webhooks, or auth route.
Do not widen CORS_ALLOWED_ORIGINS, and never introduce '*'.
Webhook handlers must verify signatures before parsing business fields, and must
be idempotent (see webhookIdempotency and 0015_webhook_idempotency.sql).
If a security control must change, write docs/adr/NNNN-*.md with the risk, the
alternative, and the rollback, then get approval.
```

---

### Phase 6 — Payments, fulfilment and email, end to end

**Objective:** a real order can be paid, fulfilled and emailed in staging, and
the failure paths behave.

**Steps**
1. **PayFast sandbox.** With `VITE_PAYFAST_SANDBOX=true` and
   `VITE_PAYMENT_PROVIDER_MODE=payfast`, complete a full checkout:
   initiate → PayFast sandbox → ITN to `/api/webhooks/payfast` → order becomes
   `paid`. Keep the raw ITN and the order row as evidence.
2. **Idempotency and replay.** Replay the same ITN twice; exactly one order
   transition must occur (`0015_webhook_idempotency.sql`,
   `0028_webhook_claim_atomicity.sql`, `webhookIdempotency`). Replay with a wrong
   amount and a wrong signature; both must be rejected and must not change state.
3. **Inventory concurrency.** With stock = 1, fire two concurrent purchases.
   Exactly one must succeed (`0019_concurrency_hardening.sql`). Capture the two
   responses. A payment failure must not leave stock decremented.
4. **Carrier.** With the real carrier integration from Phase 3: generate a
   waybill for a paid order and receive a tracking webhook with a valid HMAC.
   Verify the order timeline updates. If you chose the honest-stub path, this
   step is explicitly deferred and must be written into the go/no-go record.
5. **Email.** Send an order confirmation through Resend
   (`/api/notifications/email/order-confirmation`). Verify SPF/DKIM/DMARC for the
   sending domain and confirm the message lands in the inbox, not spam.
6. **Order status persistence.** `develop` added
   `admin_transition_order_status` for admin status changes — verify an admin
   status change persists in Supabase and is reflected in the customer timeline.
7. **Reconciliation.** Confirm a paid-but-unfulfilled order surfaces in the admin
   dashboard (`analyticsAdminRepository`) and can be reconciled.

**Deliverables:** ITN transcript, replay results, concurrency result, waybill +
tracking event, email headers, admin persistence proof.

**Exit gate:** every step above has captured output in
`docs/production-evidence/phase6-*/`.

**Agent rules — paste into Cline / Claude**
```
Payments and inventory are money. Every change needs a test that proves the
failure path, not just the happy path.
All order state transitions must be atomic and idempotent. Never mutate order
status from the client. Use the existing server/RPC paths.
Never change amount, currency, or order-code validation to make a test pass.
Never store or log raw card data, ITN payloads with signatures, or API keys.
Webhook handlers must return 2xx only after the state change is committed.
If a provider is not configured, fail closed with a clear error; never simulate
success.
```


---

### Phase 7 — Observability, CI/CD and release gates on Render

**Objective:** you can see failures before customers report them, and a bad build
cannot reach production.

**Steps**
1. **Real error tracking (finding C4).** Add `@sentry/react` and `@sentry/node`.
   Initialise the server SDK in `server.ts` and the client SDK in `src/main.tsx`,
   both gated on `SENTRY_DSN`. Delete the fake POST from `monitoringService.ts`
   and route through the SDK. Verify a thrown error in staging appears in Sentry.
2. **Structured logs.** Keep the JSON logger. Ensure `requestId` propagates into
   error reports. Do not add a log-drain vendor without instruction — Render's
   log stream is enough to start.
3. **Uptime monitoring.** External synthetic probe against `/api/health` every
   60 s from at least two regions; alert on 3 consecutive failures. Add a second
   probe against `/api/ready`.
4. **Release gate.** Keep `npm run release:gate` (`scripts/release-gate.mjs`) as
   the merge requirement into `develop`. Add the RLS and staging smoke suites to
   the staging deploy verification, not just CI.
5. **CI matrix.** Keep `test-and-build.yml` + `staging.yml`. Remove the
   duplicated "Stop local Supabase" step and the duplicated `playwright-report/`
   gitignore entry (finding C16). Confirm `REQUIRE_SUPABASE=true` on the
   migration gate.
6. **Rollback.** Render keeps previous deploys; document "rollback = redeploy the
   previous successful deploy, then re-run `/api/ready`". Replace the Cloud Run
   revision text in `docs/DEPLOYMENT_RUNBOOK.md`.
7. **Cost and scale sanity.** Decide instance count and plan tier; confirm the
   in-memory rate-limit implications at that count.

**Deliverables:** Sentry receiving real events, uptime probes live, release gate
enforced, rollback documented and rehearsed.

**Exit gate:** a deliberately thrown staging error appears in Sentry within 60 s;
`npm run release:gate` fails when a suite is broken; rollback rehearsed once.

**Agent rules — paste into Cline / Claude**
```
Observability must be real. Never claim an error is "reported" unless an SDK
actually sends it and you verified it in the dashboard.
Do not add a new SaaS dependency (logging, APM, queue, cache) without explicit
instruction and an ADR.
Every new endpoint gets: a rate-limit decision, an auth decision, and a test.
CI must stay green and must not be made "advisory" (continue-on-error: true) to
get a merge through.
Never disable a release gate to unblock a PR. Fix the code or revert the change.
```

---

### Phase 8 — Launch cutover, smoke tests and go/no-go

**Objective:** a controlled, reversible production launch.

**Steps**
1. **Pre-flight.** Production Supabase project migrated and RLS-verified;
   production Render service configured with the full env set; `VITE_*` values
   set **before** the build; `CUSTOMER_ORIGIN`/`ADMIN_ORIGIN` match the real
   domains; `VITE_PAYFAST_SANDBOX=false` and live PayFast credentials in place.
2. **Dry-run the cutover on staging.** Execute the exact production steps against
   staging, including a rollback, and time it.
3. **DNS.** Point `kixora.com` and `admin.kixora.com` at Render. Render issues
   and renews TLS automatically. Do not add a CDN in front without instruction —
   it changes the client IP that rate limiting and logging see.
4. **Cutover sequence.** (a) maintenance banner if a locking migration is
   required, (b) apply migrations, (c) deploy, (d) verify `/api/health` and
   `/api/ready`, (e) DNS switch, (f) verify TLS on both origins, (g) run the
   smoke suite.
5. **Smoke tests.** `GET /api/health` 200; `GET /` 200 with the expected title;
   `/api/ready` reports the live payment provider; a real payment completes; a
   bad ITN is rejected 400/401; admin routes 403 for a customer token; storefront
   renders live catalog.
6. **Go/no-go record.** Write `docs/production-evidence/go-no-go.md` with each
   checklist item, its evidence link, and a pass/fail. No item is "assumed".
7. **Post-launch.** Monitor 60 minutes: 5xx rate, webhook verification failures,
   `/api/ready` state, Sentry issue count. Keep the previous deploy warm for
   rollback.

**Deliverables:** completed go/no-go record, smoke test transcript, rollback
rehearsal evidence, monitoring dashboard link.

**Exit gate:** every go/no-go line has evidence, and a rollback has been executed
successfully at least once.

**Agent rules — paste into Cline / Claude**
```
Production changes are human-gated. Never deploy to production, never run a
production migration, and never flip a production secret without explicit
confirmation in this conversation.
Never set VITE_PAYFAST_SANDBOX=true in a production environment.
Report status from command output, not from assumption. If you did not run it,
say "not verified".
After any production change, verify /api/health AND /api/ready and paste both
responses.
If something fails during cutover, stop and report. Do not "try one more thing".
```


---

## Part C — Standing rules for Claude and coding agents

Two files at the repo root, committed in Phase 0, are the durable contract:

- **`CLAUDE.md`** — for Claude (planning, prompt generation, review).
- **`AGENTS.md`** — for Cline, GitHub Copilot and Codex (editing agents).

They contain the same non-negotiables plus stack facts. The per-phase rules above
are the *phase-specific* additions; the root files are always in effect.

### The five non-negotiables (repeat them in every prompt you generate)

1. **One platform.** Render + Supabase. No GCP, Cloud Run, Cloudflare, Vercel,
   Netlify, Firebase, Gemini or Google Drive.
2. **No secrets in the client.** Nothing sensitive may carry a `VITE_` prefix.
3. **Fail closed.** A missing credential or a simulated provider must produce a
   failure, never fabricated success.
4. **Migrations, not edits.** Schema changes are new numbered SQL migrations,
   applied to staging before production.
5. **Evidence, not claims.** Every phase gate is a command output or a captured
   response. "Should work" is not a gate.

### Prompt template for Claude (to generate a Cline/Copilot/Codex prompt)

```
Role: You are writing a prompt for an editing agent (Cline / Copilot / Codex)
working in the Kixora repo on branch <branch>.

Context
- Stack: React+Vite+TS+Tailwind, Express server.ts, Supabase (Postgres/Auth/
  Storage/Realtime), deployed on Render.
- Phase: <phase name from docs/PRODUCTION_READY_WORKFLOW.md>
- Goal: <one sentence>
- Files in scope: <explicit list. Nothing else may be touched.>
- Files out of scope: everything else, especially migrations already applied.

Constraints (restate all of them)
- npm only; never bun. Node 22.
- Never commit or print secrets. Never add a VITE_ variable holding a secret.
- Do not disable RLS, CSRF, CORS validation, rate limits, or the live-data gate.
- Smallest viable diff. No unrelated refactors. No new dependencies without
  approval.
- Windows PowerShell: one command per line, never &&.

Required verification (report raw output for each)
1. npx tsc --noEmit
2. npx eslint . --max-warnings 0
3. npm run test
4. npm run build

Definition of done
- <phase exit gate copied verbatim from the workflow doc>
- A short diff summary and the raw verification output.

If anything is ambiguous or a test fails, stop and ask. Do not improvise.
```

### Phase → rule file mapping

| Phase | Root rules that matter most |
|---|---|
| 0 Baseline | `AGENTS.md` §Scope, §Commands |
| 1 De-platform | `AGENTS.md` §Platform, `CLAUDE.md` §Platform |
| 2 Supabase | `AGENTS.md` §Database, `.agents/skills/supabase-postgres-best-practices` |
| 3 Drivers | `AGENTS.md` §Providers |
| 4 Build integrity | `AGENTS.md` §Build, `CLAUDE.md` §Build |
| 5 Security | `AGENTS.md` §Security |
| 6 Payments/fulfilment | `AGENTS.md` §Money |
| 7 Observability | `CLAUDE.md` §Honesty |
| 8 Launch | `CLAUDE.md` §Production gate |


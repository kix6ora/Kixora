# Kixora — Production Readiness Roadmap

**Product:** Kixora — premium sneaker e-commerce web app (customer storefront + admin hub)
**Repo:** `/workspace` (branch audited: `main` @ `e4c973a`)
**Audit method:** full repository read + executed verification commands (results below)
**Verdict:** **Needs Work — High Risk on money/fulfilment paths**

---

## 1. What this document is

A realistic, phased plan to take the current repository from "impressive
mock-mode/QA build" to "safe to sell to real customers". Every item below is
derived from files that actually exist in this repo — nothing invented. Where a
doc in the repo claims something the code does not do, that discrepancy is
called out explicitly.

---

## 2. Repository inventory (what actually exists)

### Top-level

| Path | Purpose |
| --- | --- |
| `server.ts` | Express 5 production server: security middleware, webhook ingress, health/ready, SPA serving |
| `src/` | React frontend (131 files, ~19.4k LOC): components, hooks, repositories, services, config, routes |
| `supabase/migrations/` | 33 numbered SQL migrations (schema, RLS, RPCs, storage, hardening) |
| `supabase/seed/` | Catalog seed + staging demo orders |
| `supabase/tests/validate_database.ts` | DB validation script used by the release gate |
| `tests/` | 52 files: Vitest unit/component + Playwright e2e (customer, admin, security, commerce, observability, integrations) |
| `.github/workflows/` | `test-and-build.yml`, `staging.yml`, `deploy-staging.yml`, `deploy-production.yml` |
| `scripts/` | `release-gate.mjs`, `supabase-gate.mjs`, `verify-deploy-env.mjs`, `playwright-server.ts`, `scripts/staging/*` |
| `Dockerfile` | Multi-stage build (node:22-alpine → node:22-slim, non-root user) |
| `docs/` | Extensive ops docs: `DEPLOYMENT_RUNBOOK.md`, `BACKUP_AND_DISASTER_RECOVERY.md`, `STAGING_SETUP_GUIDE.md`, `PRODUCTION_PHASES.md`, `qa/*`, `production-evidence/*` |
| `PRODUCTION_LAUNCH.md`, `PRODUCTION_READINESS_AUDIT.md`, `TESTING.md`, `QA_STLC_CHECKLIST.md` | Launch/audit/QA narrative docs |
| `kixora-staging-blockers.patch` | 38 KB stale patch, **partially applied** (e.g. `src/lib/supabaseAdmin.ts` already exists in tree) — dead artifact |
| `logger.ts` | Structured JSON logger with PII sanitisation |
| `.env.example` | Documented env contract (client `VITE_*` + server secrets) |
| `public/` | `manifest.json`, `icon.svg`, `icon-192.png`, `icon-512.png`, `sw.js` |

### Frontend structure (`src/`)

- `App.tsx` — SPA shell; view switching via `useState` (no router library), lazy-loaded admin hub, cookie-consent banner
- `components/` — 23 storefront components (Hero, Filters, ProductCard/Modal, CartDrawer, CheckoutModal, PayFastReturn, DropsCalendar, OrderTrackingModal, WishlistModal, CustomerAuthModal, Sneaker3D*, SEO, Toast, Navbar, MobileNav, Footer…)
- `components/admin/` — 7 admin screens (Dashboard, Products, Orders, Inventory, Promos, Analytics, SignOut)
- `context/StoreContext.tsx` — 935-line global store (catalog, filters, cart, wishlist, orders, promos, toasts) with localStorage persistence
- `context/adapters/` — cart/catalog/wishlist adapters switching between mock and Supabase
- `repositories/` — layered DAL: `customer/*` (cart, drops, order, product, wishlist), `admin/*` (audit, drops, inventory, order, product, promo, analytics) + legacy top-level duplicates
- `services/` — auth, checkout, payment, webhook, promo, inventory(+sync), fulfillment, email, shipping (carrier + tracking webhook), storage, analytics, audit, monitoring, googleDrive
- `services/payments/` — driver registry: `payfastDriver`, `mockDriver`, `crypto` (MD5 signature), `payfastCheckout`, `webhookIdempotency`
- `routes/` — `AdminRoute`, `DomainGuard`, `ProtectedRoute`
- `config/` — `env.ts` (validation), `features.ts` (14 feature flags), `cors.ts`, `cspImageSources.ts`
- `hooks/` — `useAuth`, `useCart`, `useOrders`, `useProducts`, `useDrops`, `useWishlist`, `useGoogleAuth`, `useUserRole` + `hooks/admin/*`

---

## 3. Verified tech stack

| Layer | Technology | Evidence |
| --- | --- | --- |
| Frontend | React 18.3 + TypeScript 5.7 + Vite 6.4 | `package.json`, `vite.config.ts` |
| Styling | TailwindCSS 3.4 (custom `kixora`/`vault` tokens, `#FF7A00` accent) | `tailwind.config.js`, `src/index.css` |
| Motion/UI | `motion` (Framer Motion API), `lucide-react`, `clsx`, `tailwind-merge` | `package.json` |
| 3D | `three`, `@react-three/fiber`, `@react-three/drei` (WebGL viewer + CSS fallback) | `src/components/Sneaker3D*.tsx` |
| SEO | `react-helmet-async` (`SEO.tsx`), server crawler interceptor for `/product/:id` | `src/components/SEO.tsx`, `server.ts` |
| Backend | Express 5.2 (`server.ts`), esbuild-bundled to `dist/server.cjs` | `package.json`, `Dockerfile` |
| Auth | Supabase Auth (email/password + Google GSI script) + mock/localStorage fallback | `src/services/authService.ts`, `src/hooks/useGoogleAuth.ts` |
| Database | Supabase Postgres 15, 33 migrations, RLS on tables + storage, `SECURITY DEFINER` RPCs | `supabase/migrations/*`, `supabase/config.toml` |
| Payments | PayFast (sandbox/prod) MD5 signature + ITN postback validation; mock driver blocked in prod | `src/services/payments/*`, `server.ts` |
| Shipping | The Courier Guy driver — **simulated rates/labels only** | `src/services/shipping/carrierDrivers.ts` |
| Email | Resend REST API via `fetch`, console fallback | `src/services/email/emailService.ts` |
| Media | Cloudinary + Supabase Storage buckets | `src/lib/cloudinary.ts`, `src/services/storageService.ts` |
| Deployment | Docker multi-stage → Google Cloud Run + Artifact Registry; Cloudflare DNS/CDN per docs | `Dockerfile`, `.github/workflows/deploy-*.yml`, `PRODUCTION_LAUNCH.md` |
| Unit tests | Vitest 5 + Testing Library + jsdom | `vitest.config.ts` |
| E2E tests | Playwright (chromium, 1 worker, mock-mode webServer bootstrap) | `playwright.config.ts`, `scripts/playwright-server.ts` |
| Lint/type | ESLint 10 (`--max-warnings 0`) + `tsc --noEmit` | `eslint.config.js`, CI |

---

## 4. Commands actually run (evidence)

| Command | Result |
| --- | --- |
| `npm ci` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint . --max-warnings 0` | exit 0 |
| `npm run test` (Vitest) | **15 passed / 2 failed files — 45 passed / 2 failed tests** |
| `npx playwright test` | **110 passed / 55 failed** — every failure was `browserType.launch: Target page, context or browser has been closed` (browser crash inside this sandbox), not an app assertion failure |

**Failing unit tests (real product defects, not sandbox noise):**

1. `tests/unit/shipping-service.test.ts` — expects fallback courier quotes in
   production; the code throws
   `"The Courier Guy API integration is not implemented; production rates are unavailable."`
   Test expectation and implementation disagree.
2. `tests/unit/staticAssets.test.ts` — expects `public/manifest.json` to declare
   `/icon-192.png` and `/icon-512.png`; the manifest only declares `icon.svg`,
   while `src/server/staticAssets.ts` deliberately returns **404** for
   `/icon-*.png`. PWA install icons are therefore unreachable in production.


---

## 5. Gap assessment by production area

### 5.1 Authentication & Authorisation — *Partially solid, incomplete*

**Exists:** Supabase Auth integration, role extraction strictly from
`app_metadata` (`src/utils/roleUtils.ts`), mock fallback session in
`localStorage`, `AdminRoute` + `DomainGuard` + `ProtectedRoute` guards,
`useAuth`/`useUserRole` hooks, DB role-sync trigger (`0012_auth_role_sync.sql`),
`guard_role_escalation()` trigger, RLS policies (`0010_rls.sql`,
`0025_rls_hardening.sql`).

**Gaps:**
- **No password reset / forgot-password / email-verification UI anywhere**
  (grep for `resetPassword`/`forgot` returns nothing). A user who forgets a
  password is permanently locked out.
- Local Supabase config sets `enable_confirmations = false`
  (`supabase/config.toml`) — unverified emails are acceptable.
- No MFA, no session/device listing, no "sign out all sessions".
- Admin isolation is **client-side only** (`DomainGuard` compares
  `window.location.hostname`). Anyone can load the admin bundle and call
  Supabase with a customer token — only RLS and `is_admin()` protect data.
- Test escape hatch in shipped code: `VITE_PLAYWRIGHT_ADMIN === 'true'` +
  `?domain=admin` bypasses `DomainGuard` (`src/routes/DomainGuard.tsx:24-26`),
  and `VITE_*` values are baked into the client bundle at build time.
- No server-side rule that admin HTML/JS is only served on the admin origin.

### 5.2 Security — *Above average for a demo, several real holes*

**Exists:** Helmet + custom CSP, `X-Frame-Options: DENY`, HSTS, explicit CORS
allowlist that fails closed in production, `csurf` CSRF on `/api/payments`,
`/api/shipping`, `/api/notifications`, `express-rate-limit` (100/15 min global,
10/hour auth, 5/hour checkout), webhook signature verification (PayFast MD5 +
carrier HMAC-SHA256 with 300 s replay window), webhook idempotency
(`claim_webhook_event`, migrations `0015`/`0028`), amount + currency verification
on settlement (`webhookService.ts`), PII sanitisation for logs
(`src/utils/security.ts`), server secrets kept off the client in `.env.example`.

**Gaps:**
- **No input-validation library** (no zod/valibot/joi). `/api/*` handlers read
  `req.body` directly (`server.ts` shipping/email/payments routes) with ad-hoc
  `typeof` checks at best.
- `csurf` 1.11.0 is **deprecated and unmaintained** (last release 2018).
- Rate limiter uses the default **in-memory store** → limits are per Cloud Run
  instance and reset on every deploy; no Redis/Upstash backing.
- CSP allows `'unsafe-inline'` **and** `'unsafe-eval'` in `scriptSrc`
  (`server.ts:90`), which negates much of the XSS protection.
- No secret scanning / Dependabot config; only `npm audit --audit-level=high`.
- `VITE_CLOUDINARY_API_KEY` is declared and read into config but never used —
  dead client config that invites misuse.
- Webhook bodies allow `10mb` (`server.ts:200-207`).
- No test asserting the production CSP/security headers.

### 5.3 Error handling & logging — *Good on the server, thin on the client*

**Exists:** Structured JSON logger with levels + PII masking (`logger.ts`),
request-ID correlation and duration logging for every request, global Express
error handler mapping CSRF / payload-too-large / CORS to 4xx, `AppError` +
`handleSupabaseError` helpers, error boundaries inside `Sneaker3DViewer`.

**Gaps:**
- **No top-level React error boundary** — any storefront render error blanks the
  whole app.
- Client code uses `console.error`/`console.warn` widely instead of
  `monitoringService` (`authService`, `webhookService`, repositories).
- `monitoringService.dispatchToSentry()` POSTs raw JSON to the Sentry DSN. That
  is **not** the Sentry envelope/Store API contract and no `@sentry/*` package is
  installed → the "Sentry integration" is effectively a no-op.
- No error taxonomy / stable error codes on the public API surface.


### 5.4 Testing — *Broad but shallow, and currently red*

**Exists:** 47 Vitest tests (unit + component), 165 Playwright tests across
customer, admin, security, commerce, integrations, observability, regression;
fixtures that reset localStorage; a release gate chaining
lint → build → DB validation → Playwright; CI runs the suite against a local
Supabase instance; `@axe-core/playwright` installed.

**Gaps:**
- 2 unit tests currently **fail** (shipping fallback, PWA icons) — the suite is
  red, so `npm run release:gate` cannot pass.
- Coverage thresholds are effectively zero: `statements: 2, branches: 4,
  functions: 1, lines: 2`, with coverage `include` limited to 6 files
  (`vitest.config.ts`). Repositories, services, hooks and `StoreContext` are not
  measured by unit tests at all.
- **No accessibility tests** despite `@axe-core/playwright` being a devDependency
  (grep for `axe(` finds nothing).
- No load/performance testing, no Lighthouse CI, no visual regression.
- Most e2e specs run in **mock mode only** (`VITE_USE_SUPABASE_* = false` in
  `scripts/playwright-server.ts`); real Supabase paths are opt-in via
  `PLAYWRIGHT_USE_STAGING_SUPABASE` and are not in the default gate.
- No contract tests against the live PayFast or The Courier Guy sandboxes.
- No test that the admin bundle does not leak privileged data.

### 5.5 Database design, migrations & validation — *Strongest area*

**Exists:** 33 sequential migrations, normalised catalog
(brands/categories/products/product_images/product_sizes), inventory with
`reserved_stock` + `inventory_reservations`, immutable orders + `order_items` +
`order_status_history` + `shipments`, carts, wishlists, bespoke designs,
drops/raffles, promo codes + redemptions, admin audit logs, webhook events,
fulfillment tables; CHECK constraints and indexes throughout; `updated_at`
triggers; `SECURITY DEFINER` RPCs (`place_order_atomic`,
`confirm_inventory_sale`, `release_order_reservations`, `admin_*`) with
`FOR UPDATE` row locking and **server-side price recomputation**
(`0009_functions.sql:161-197` — this blocks price tampering); RLS across tables
and storage; explicit Data-API grants (`0031_explicit_data_api_grants.sql`).

**Gaps:**
- **No scheduled jobs.** `cleanup_stale_pending_orders()` and
  `cleanup_expired_reservations()` exist but there is **no `pg_cron`, no
  scheduled Cloud Run job and no queue worker** in the repo. Stale pending
  orders hold stock until an admin manually triggers cleanup
  (`src/services/adminOrderService.ts:146`).
- No down-migrations / rollback scripts; no drift detection beyond
  `scripts/supabase-gate.mjs` validation.
- Staging demo-order seed exists (`supabase/seed/02_staging_demo_orders.sql`) with
  no guard preventing it from being applied to production.
- Mixed reservation model: `place_order_atomic` decrements `stock` directly while
  `reserved_stock`/`inventory_reservations` also exist — two sources of truth for
  availability.
- `webhookService.ts` refund path inserts into `order_status_history` with
  `title`/`description` while the migration defines `status`, `title`,
  `description` — verify this path actually persists (needs a test).

### 5.6 API design & documentation — *Weak*

**Exists:** ~10 `/api/*` endpoints (health, ready, csrf, payments
initiate/status, webhooks payfast/tracking, shipping rates/labels, notifications
email), consistent `{ error }` / `{ success, ... }` shapes, sensible status codes.

**Gaps:**
- **No API documentation at all** — no OpenAPI/Swagger, no typed client, no
  collection. Grep for `openapi|swagger` returns nothing.
- No API versioning (`/api/v1/...`).
- No request/response schema validation or shared contract types between client
  and server.
- `GET /api/ready` publicly leaks configuration booleans (`paymentProvider`,
  `payfastWebhookConfigured`, `shippingWebhookConfigured`).
- No idempotency-key support for client-initiated mutations.

### 5.7 Frontend performance, accessibility & responsiveness — *Mixed*

**Exists:** Manual vendor chunk splitting (`vite.config.ts`), lazy-loaded
`AdminDashboard` + `React.Suspense`, WebGL detector with 2D fallback,
`prefers-reduced-motion` respected, Tailwind responsive classes throughout, PWA
manifest + `sw.js` present, `SEO` component with OG/Twitter tags, cookie-consent
banner.

**Gaps:**
- **No compression middleware** (`compression` is not a dependency and
  `server.ts` never enables gzip/brotli) — every asset ships uncompressed.
- **No `Cache-Control` on static assets.** `src/server/staticAssets.ts` uses bare
  `express.static(distPath)`, while `PRODUCTION_LAUNCH.md` documents
  `max-age=31536000, immutable` for `/assets/*`. Doc ≠ code.
- **`sw.js` is never registered** (no `serviceWorker.register` anywhere) → the
  documented PWA install/offline behaviour does not exist.
- Manifest declares only `icon.svg`; PNG icons 404 in production (see §4).
- Hardcoded `images.unsplash.com` fallback image URLs inside SQL
  (`0009_functions.sql:164`) and mock data.
- Accessibility is thin: only 10 of 30 components use any `aria-*` attribute
  (mostly 1–3), no focus-trap verification for modals, no automated a11y gate.
- 3D hero depends on optional `VITE_SNEAKER_MODEL_BASE_URL` — unproven in prod.
- No Core Web Vitals measurement anywhere.


### 5.8 Environment configuration & secrets — *Good design, weak enforcement*

**Exists:** `.env.example` split into client (`VITE_*`) and server-only secrets;
`.env*` gitignored except `.env.example`; `src/config/env.ts` validates
production env (payment provider must be `payfast`, PayFast credentials required,
CORS origins explicit and non-wildcard, `ADMIN_ORIGIN` ≠ `CUSTOMER_ORIGIN` and
both present in the allowlist, `VITE_PUBLIC_SITE_URL` must be an HTTPS origin);
`getPublicSiteUrl()` is called at boot in `src/main.tsx` under `PROD`.

**Gaps:**
- `scripts/verify-deploy-env.mjs` (run by both deploy workflows) validates **only
  GCP variables** (`GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT_KEY`,
  `CLOUD_RUN_REGION`, `CLOUD_RUN_SERVICE_STAGING`). It does not validate
  `CORS_ALLOWED_ORIGINS`, `ADMIN_ORIGIN`, `CUSTOMER_ORIGIN`, PayFast keys or
  `SUPABASE_SERVICE_ROLE_KEY` before a production deploy.
- The Cloud Run deploy step passes only `NODE_ENV` and `SENTRY_ENVIRONMENT`
  (`--set-env-vars`), so application secrets are not wired by the workflow — they
  must be set out-of-band and nothing verifies that they were.
- No documented or enforced secret rotation procedure.
- No `.env.staging` / `.env.production` template split; one `.env.example` for
  everything.

### 5.9 Deployment & CI/CD — *Substantial, with correctness gaps*

**Exists:** 4 GitHub workflows; CI runs `npm ci`, local Supabase start with
retries, `npm run db:gate` with `REQUIRE_SUPABASE=true`, `tsc --noEmit`, ESLint
zero-warnings, Vitest coverage, full Playwright, production build, Playwright
report artifact upload, plus a `security-audit` job (`npm audit --audit-level=high`).
Staging deploy on push to `develop`; production deploy is manual
(`workflow_dispatch`) with a health check after deploy. Multi-stage Dockerfile,
non-root runtime user. Release gate + staging scripts (`scripts/staging/*.mjs`)
for PayFast ITN replay, admin sign-out, API roles, assets and deploy waiting.

**Gaps:**
- `npm audit` blocks CI on high/critical with no auto-remediation (no Dependabot).
- No staging smoke step inside `deploy-staging.yml` (the `scripts/staging/*`
  scripts exist but are not wired into the workflow).
- No production smoke test beyond `curl /api/health`.
- No database migration step in either deploy workflow — migrations are applied
  manually per the runbook, so code and schema can drift during a release.
- No canary/traffic-split or automatic rollback in the Cloud Run deploy step.
- No image vulnerability scanning (Trivy/Grype) and no SBOM.
- `Dockerfile` runs `npm ci --omit=dev` at runtime while `dist/server.cjs` is
  built with `--packages=external` — runtime deps must match build deps exactly,
  and that is untested.
- No `.dockerignore` at the repo root, so the entire tree (including
  `node_modules`, `.git`, docs and evidence logs) is sent as Docker build context.

### 5.10 Monitoring, logging & observability — *Partial*

**Exists:** Structured JSON request logs with `requestId`, duration, status and
user-agent; `logger.debug` suppressed in production; `/api/health` with a real
Supabase `profiles` ping plus uptime/commit info; `/api/ready` config readiness;
`webhook_events` table for webhook telemetry; documented monitoring plan in
`PRODUCTION_LAUNCH.md` (uptime probes every 60 s, 5xx alerting).

**Gaps:**
- **No working error-tracking integration** (see §5.3 — the Sentry call is a
  no-op and no SDK is installed).
- No metrics/tracing: no OpenTelemetry, no Cloud Monitoring custom metrics, no
  RED/USE dashboards, no alert policies in the repo.
- No log-based alerting rules, no log retention/PII policy, no log aggregation
  config.
- No business KPIs (orders/hour, payment success rate, inventory drift, stale
  reservation count) surfaced anywhere.
- No uptime monitor configuration as code.
- Health check pings one table only; it does not verify payment provider
  reachability, carrier reachability or migration version.


### 5.11 Missing core features for a complete production webapp

- **Password reset / forgot password** — absent.
- **Email verification flow** — disabled in config, no UI.
- **Refunds / returns** — `PayFastPaymentDriver.processRefund()` returns
  `success: false` ("requires an authenticated provider refund workflow"); no
  refund UI for customers or admins (only an internal
  `admin_reconcile_payment_state` RPC).
- **Order cancellation by the customer** — absent (admin-only transitions).
- **Working shipping integration** — rates/labels are simulated and production
  throws (`src/services/shipping/shippingService.ts:38-40`). `.env.example` has
  no `ENABLE_SHIPPING` entry even though `env.ts` checks for it.
- **Live analytics** — `analyticsService.trackEvent()` only `console.log`s
  ("Mocking production analytics provider dispatch").
- **Search**: filtering is client-side over the in-memory catalog
  (`src/utils/filterSneakers.ts`) with no server-side search or pagination.
- **Customer account area**: no order-history page, no saved addresses, no
  profile management beyond auth.
- **Reviews/ratings**: `products.rating` / `reviews_count` exist in schema and
  seed data, but there is no review submission or moderation feature.
- **Tax handling**: `orders.tax` is hardcoded to `0.00` in `place_order_atomic`
  — no VAT/tax engine.
- **Multi-currency**: ZAR only, hardcoded.
- **`robots.txt` / `sitemap.xml`** — absent from `public/`.
- **Real OG images**: `/og-image-default.png` is referenced by `SEO.tsx` and the
  crawler interceptor but does not exist in `public/`; the crawler path serves
  hardcoded tags with a comment admitting it does not fetch product data.
- **Legal/consent**: a cookie banner exists, but there are no Terms / Privacy /
  Returns policy pages and no POPIA data-subject request flow.

### 5.12 Technical debt & code quality

- `src/context/StoreContext.tsx` is a 935-line god-object holding catalog,
  filters, cart, wishlist, orders, promos and toasts with localStorage
  persistence — the highest-risk file in the frontend.
- **Two parallel data paths everywhere** (14 `VITE_USE_SUPABASE_*` flags in
  `src/config/features.ts`): localStorage/mock vs Supabase. Every feature must be
  reasoned about twice, and the mock path is the one exercised by default in
  tests.
- Duplicate repository layers: legacy `src/repositories/*.ts` alongside
  `src/repositories/customer/*` and `src/repositories/admin/*`, both calling the
  same RPCs (`adminRepository.ts` vs `repositories/admin/*`).
- `src/services/checkoutService.ts` **hardcodes promo codes** (`KIXORA10`,
  `GRAIL20`) and a 10% discount computation client-side, duplicating the
  authoritative `promo_codes` logic in `place_order_atomic` — guaranteed drift
  between displayed and charged totals.
- `src/services/googleDriveService.ts` exists with no UI entry point found.
- `kixora-staging-blockers.patch` (38 KB) is a stale, partially applied artifact
  in the repo root.
- `README.md` is one sentence; onboarding knowledge is scattered across 15+ docs.
- `.env.example` advertises `VITE_CLOUDINARY_API_KEY` (unused) as a client var.
- No `.dockerignore`.


---

# 6. The Roadmap

Legend: **Size** S = ≤ 1 session, M = 1–3 sessions, L = multi-session / needs a
design decision. **Order** = suggested sequence inside the phase.

---

### Phase 0 – Foundation & Safety

> Nothing else should be built until the repository is honest: green gates,
> no test-only escape hatches in shipped code, and docs that match reality.

**0.1 Resolve the two failing unit tests (decide behaviour, then make code and
test agree)**
- **What:** `tests/unit/shipping-service.test.ts` expects fallback quotes in
  production while `shippingService` throws; `tests/unit/staticAssets.test.ts`
  expects PNG icons in `manifest.json` while the manifest only has `icon.svg` and
  `staticAssets.ts` 404s `/icon-*.png`. For each: decide the intended production
  behaviour, change the code, and update the test to match.
- **Why:** The suite is red, which means the release gate cannot be trusted as a
  signal. A red suite also hides new regressions.
- **Size:** S
- **Order:** 1
- **Acceptance criteria:** `npm run test` exits 0 with 0 failing tests; the
  shipping behaviour in production is a deliberate, documented decision (either
  "throw and surface an outage banner" or "return fallback rates");
  `manifest.json` and `staticAssets.ts` agree on which icon files exist and are
  served.

**0.2 Make `npm run release:gate` a single, trustworthy green gate**
- **What:** `scripts/release-gate.mjs` chains lint → build → DB validation →
  selected Playwright specs. Ensure it runs from a clean checkout and either
  passes or fails for real reasons (no silently skipped suites).
- **Why:** This is the only automated definition of "releasable" today. If it
  cannot pass, every later phase has no safety net.
- **Size:** S
- **Order:** 2
- **Acceptance criteria:** `npm run release:gate` exits 0 on the current commit;
  output lists every suite that ran; adding a deliberately broken assertion makes
  the gate fail.

**0.3 Remove the test-only admin-domain bypass from production code**
- **What:** `src/routes/DomainGuard.tsx` treats `VITE_PLAYWRIGHT_ADMIN === 'true'`
  plus `?domain=admin` as a valid admin domain. Gate it so it can never be true in
  a production build (e.g. only honour it when `import.meta.env.MODE === 'test'`),
  and add a test that a production build ignores it.
- **Why:** `VITE_*` values are baked into the shipped bundle. One mis-set build
  variable turns domain isolation off for everyone.
- **Size:** S
- **Order:** 3
- **Acceptance criteria:** A production build with `VITE_PLAYWRIGHT_ADMIN=true`
  still renders the 404 guard for `?domain=admin`; a unit test asserts this.

**0.4 Reconcile documentation with code (caching, PWA, Sentry, shipping)**
- **What:** Update `PRODUCTION_LAUNCH.md` / `PRODUCTION_READINESS_AUDIT.md` where
  they describe behaviour that does not exist: immutable `Cache-Control` for
  `/assets/*`, installable PWA, working Sentry error tracking, and any implication
  that carrier APIs are live. Either mark each "not implemented — tracked in
  Phase X" or implement it there.
- **Why:** The audit docs currently overstate readiness, which is exactly how a
  team ships something it believes is safer than it is.
- **Size:** S
- **Order:** 4
- **Acceptance criteria:** Every claim in `PRODUCTION_LAUNCH.md` maps to a real
  file/behaviour or is explicitly flagged as pending with a phase reference.

**0.5 Clean the repository of stale artifacts and add `.dockerignore`**
- **What:** Delete or archive `kixora-staging-blockers.patch` (38 KB, partially
  applied), decide on `src/services/googleDriveService.ts` (wire it up or remove
  it), and add a `.dockerignore` excluding `node_modules`, `.git`, `tests`,
  `docs`, `coverage`, `playwright-report`.
- **Why:** A stale patch invites someone to apply it and reintroduce old bugs; no
  `.dockerignore` bloats build context and can leak local files into images.
- **Size:** S
- **Order:** 5
- **Acceptance criteria:** No orphaned patch file; `docker build` context is small
  (< ~5 MB excluding source); the resulting image still serves `/api/health`.

**0.6 Environment/secrets hygiene pass**
- **What:** Remove the unused `VITE_CLOUDINARY_API_KEY` from `.env.example` and
  `src/config/env.ts`, add a comment block in `.env.example` stating that every
  `VITE_*` value is public, and document which values must differ between staging
  and production.
- **Why:** Misleading client-side secret entries encourage developers to treat
  `VITE_*` as private, which is how keys leak.
- **Size:** S
- **Order:** 6
- **Acceptance criteria:** `.env.example` contains no unused variables; a
  "public vs secret" table exists in the file or `docs/DEPLOYMENT_RUNBOOK.md`.


**0.7 Turn off the mock data path in production builds**
- **What:** The storefront defaults to localStorage/mock catalog unless
  `VITE_USE_SUPABASE_*` flags are set (`src/config/features.ts`). Add a startup
  guard that fails the production build/boot if the core flags
  (`USE_SUPABASE_CATALOG`, `USE_SUPABASE_AUTH`, `USE_SUPABASE_CHECKOUT`,
  `USE_SUPABASE_ORDERS`) are false, mirroring the existing "mock payments are
  prohibited in production" guard in `src/config/env.ts`.
- **Why:** A production deploy with a forgotten flag silently serves fake data and
  fake orders — the most damaging possible failure mode for a shop.
- **Size:** M
- **Order:** 7
- **Acceptance criteria:** `NODE_ENV=production` with mock flags off throws at
  startup with a clear message; a unit test covers it; staging runs with all core
  flags true.

**0.8 Establish the branch/release discipline**
- **What:** Document and enforce the branch model (`main` + `develop` +
  `remediation/**` are referenced by CI), require PR review and a passing
  `test-and-build` check before merge, and delete stale branches.
- **Why:** The repo shows a merge from `develop` into `main` with no evidence of
  required checks; without this, Phase 1+ work can land unreviewed.
- **Size:** S
- **Order:** 8
- **Acceptance criteria:** Branch protection is enabled on `main` (required
  checks: lint/type/test, no direct pushes); the rules are written down in
  `docs/DEPLOYMENT_RUNBOOK.md`.


---

### Phase 1 – Core Production Requirements

> The minimum bar before a single real customer can pay real money.

**1.1 Password reset, forgot-password and email-verification flows**
- **What:** Add Supabase `resetPasswordForEmail` + `updateUser` flows and UI
  (request link, set-new-password screen, expired/invalid token handling) and turn
  on email confirmation in the Supabase auth config. Use a `getPublicSiteUrl()`
  based redirect that is allowlisted in Supabase.
- **Why:** Today a customer who forgets a password can never recover an account,
  and unverified emails are accepted (`supabase/config.toml`).
- **Size:** M
- **Order:** 1
- **Acceptance criteria:** A user can complete reset end-to-end in staging; an
  expired/used link shows a friendly error; unverified users cannot check out;
  a Playwright spec covers request → token → new password → sign-in.

**1.2 Real error tracking and client-side error reporting**
- **What:** Install the actual `@sentry/react` + `@sentry/node` SDKs (or a chosen
  alternative), initialise them from `SENTRY_DSN`/`SENTRY_ENVIRONMENT`, capture
  unhandled Express errors, and route the existing
  `monitoringService.reportError` calls through the SDK. Add a top-level React
  error boundary that reports and renders a branded fallback.
- **Why:** The current `dispatchToSentry` posts raw JSON to the DSN — a no-op.
  Production incidents would be invisible, and a render error currently blanks the
  entire storefront.
- **Size:** M
- **Order:** 2
- **Acceptance criteria:** A forced server exception and a forced client exception
  both appear in the error-tracking project with a release tag and no PII; a
  render error shows a fallback UI instead of a blank page.

**1.3 Schema-validated input on every `/api/*` route**
- **What:** Add a validation library (zod or equivalent), define schemas for
  `/api/payments/payfast/initiate`, `/api/payments/payfast/status`,
  `/api/shipping/rates`, `/api/shipping/labels`,
  `/api/notifications/email/order-confirmation`, and both webhook payloads;
  reject with 400 + a stable error code, and adopt consistent error codes across
  the API surface.
- **Why:** Handlers currently read `req.body` fields directly; malformed input
  reaches business logic and third-party APIs.
- **Size:** M
- **Order:** 3
- **Acceptance criteria:** Every `/api/*` mutation route rejects invalid payloads
  with 400 and a documented error code; unit tests cover one valid and one invalid
  case per route.

**1.4 Complete the payment lifecycle: refunds, cancellation, reconciliation**
- **What:** Implement `processRefund` against PayFast (or a documented manual
  finance workflow with an admin UI + audit log), allow customers to cancel a
  pending order, and expose the existing `admin_reconcile_payment_state` /
  `cleanup_stale_pending_orders` RPCs in the admin UI with audit logging.
- **Why:** Refunds are a legal/support necessity in e-commerce and the driver
  currently returns `success: false`. Cancellation and reconciliation directly
  affect stock accuracy.
- **Size:** L
- **Order:** 4
- **Acceptance criteria:** An admin can refund a paid order and the order, stock
  and audit log all update consistently; a customer can cancel a pending order and
  stock is released; staging exercises both against the PayFast sandbox.

**1.5 Finish or explicitly disable the shipping integration**
- **What:** Either implement real The Courier Guy API calls in
  `TheCourierGuyDriver` (rates, waybill, tracking) with sandbox proof, or remove
  the "The Courier Guy" claim from the product and run a documented
  flat-rate/manual fulfilment model. Add `ENABLE_SHIPPING` to `.env.example` and
  validate it.
- **Why:** `shippingService` throws in production and the driver returns hardcoded
  prices. Customers would see shipping fail at checkout, and the `/api/shipping/*`
  smoke tests in `PRODUCTION_LAUNCH.md` cannot pass.
- **Size:** L
- **Order:** 5
- **Acceptance criteria:** Checkout shows real or intentionally-fixed shipping
  rates in staging; `/api/shipping/rates` returns 200 with a live or documented
  deterministic quote; the chosen model is stated in customer-facing copy and the
  runbook.

**1.6 Scheduled maintenance jobs for reservations and stale orders**
- **What:** Schedule `cleanup_stale_pending_orders()` and
  `cleanup_expired_reservations()` (pg_cron, Supabase scheduled function, or a
  Cloud Run job) with alerting on failure.
- **Why:** Nothing in the repo runs them. Without this, abandoned checkouts hold
  stock forever and inventory silently under-sells.
- **Size:** M
- **Order:** 6
- **Acceptance criteria:** A job runs on a defined interval in staging; a
  deliberately stale pending order is released automatically; failures raise an
  alert; the schedule is documented in the runbook.


**1.7 Harden admin isolation beyond the client-side domain check**
- **What:** Stop relying on `DomainGuard` alone. Add (a) a server-side rule/edge
  rule that admin routes are only served on the admin origin, (b) Supabase RLS
  tests proving a customer JWT cannot read admin tables, and (c) a check that the
  admin bundle is not loaded on the customer origin.
- **Why:** Today a customer could load the admin SPA and hit Supabase directly;
  only RLS stands between them and admin data. One missing policy is a breach.
- **Size:** M
- **Order:** 7
- **Acceptance criteria:** Requesting admin routes on the customer origin returns
  404 from the server (not just the client); a Playwright spec asserts a customer
  session cannot read `orders`/`admin_audit_logs`/`promo_codes` admin rows.

**1.8 Production environment validation inside the deploy pipeline**
- **What:** Extend `scripts/verify-deploy-env.mjs` (and the deploy workflows) to
  require and validate the app-level variables: `CORS_ALLOWED_ORIGINS`,
  `ADMIN_ORIGIN`, `CUSTOMER_ORIGIN` (distinct HTTPS), `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, PayFast keys +
  passphrase, and `VITE_PAYMENT_PROVIDER_MODE=payfast`. Fail the deploy before
  building if any are missing.
- **Why:** The workflow currently checks only GCP variables; a deploy can succeed
  and boot into a broken configuration.
- **Size:** S
- **Order:** 8
- **Acceptance criteria:** Removing any required secret fails the workflow with a
  named variable; a correct staging set passes; the checks are documented in
  `docs/DEPLOYMENT_RUNBOOK.md`.

**1.9 Apply database migrations as part of the release pipeline**
- **What:** Add a migration step to the staging and production deploy workflows
  (with an explicit approval gate for production) so schema changes ship with the
  code that needs them.
- **Why:** Migrations are currently manual. Code and schema can drift during a
  release, which is how "works in staging, breaks in prod" happens.
- **Size:** M
- **Order:** 9
- **Acceptance criteria:** Deploying to staging applies any new migrations and
  aborts on failure; production requires manual approval before applying; the
  applied revision is recorded in the release notes.

**1.10 Compression, cache headers and asset delivery**
- **What:** Add gzip/brotli compression (`compression` middleware or Cloud Run/CDN
  level), set `Cache-Control: public, max-age=31536000, immutable` for hashed
  `/assets/*` and `no-store` for `/api/*`, and keep `index.html` uncached.
- **Why:** `PRODUCTION_LAUNCH.md` documents this behaviour but
  `src/server/staticAssets.ts` implements none of it — today every asset is
  uncompressed and uncached.
- **Size:** S
- **Order:** 10
- **Acceptance criteria:** `curl -H 'Accept-Encoding: gzip'` on a JS asset returns
  `Content-Encoding: gzip` and an immutable cache header; `/api/health` returns
  `Cache-Control: no-store`; `index.html` is revalidated.

**1.11 Make the PWA claim true or drop it**
- **What:** Add `icon-192.png`/`icon-512.png` to `manifest.json`, stop 404-ing
  them in `staticAssets.ts`, and register `public/sw.js` with a versioned cache
  name; or remove the manifest/service-worker claims and the "PWA Ready" copy.
- **Why:** The manifest and `sw.js` exist but nothing registers the worker and the
  PNG icons are unreachable — installability is currently fake.
- **Size:** M
- **Order:** 11
- **Acceptance criteria:** Chrome reports the app as installable in staging with
  correct 192/512 icons; the service worker registers and serves a cached shell
  offline; `npm run test` passes the icon test.

**1.12 Minimum legal/compliance surface (POPIA-relevant)**
- **What:** Publish Terms of Service, Privacy Policy and Returns/Refunds pages;
  link them from the footer; add a POPIA data-subject request path (email or form)
  and a documented data-retention statement. Verify the cookie banner actually
  blocks analytics before consent (`analyticsService` already supports opt-out).
- **Why:** The app collects names, emails, phones and addresses and takes card
  payments via PayFast; launching without a privacy policy and returns policy is a
  legal risk in South Africa and blocks payment-provider onboarding.
- **Size:** M
- **Order:** 12
- **Acceptance criteria:** All three pages exist, are reachable from the footer,
  and are referenced from the checkout consent copy; no analytics event fires
  before consent is granted.


---

### Phase 2 – Stability & Quality

> Make the system provable: tests that mean something, limits that hold under
> real traffic, and visibility when things break.

**2.1 Raise real test coverage on the money paths**
- **What:** Replace the placeholder coverage config (`statements: 2, branches: 4,
  functions: 1, lines: 2` over 6 files) with meaningful targets for
  `src/services/**`, `src/repositories/**`, `src/utils/**` and the payment/webhook
  modules; add unit tests for `place_order_atomic` error mapping,
  `webhookService.reconcileOrderState`, `payfastCheckout`, `webhookIdempotency`,
  `promoService`, `inventoryService` and `checkoutService`.
- **Why:** These are the paths where a bug costs money. Today they are effectively
  untested at the unit level.
- **Size:** L
- **Order:** 1
- **Acceptance criteria:** Coverage thresholds ≥ 60% statements/lines on the
  scoped money-path modules (enforced in `vitest.config.ts`, failing CI below
  threshold); at least one test per payment state transition (pending → paid →
  refunded, pending → failed, duplicate ITN, wrong amount, wrong currency).

**2.2 Accessibility gate and remediation**
- **What:** Add axe (`@axe-core/playwright`, already installed) to key Playwright
  specs (home, product modal, cart drawer, checkout, admin login) and fix the
  findings; add focus management/trapping to modals and `aria-*` labels to icon
  buttons.
- **Why:** The dependency is installed but unused; only 10 of 30 components use any
  `aria-*` attribute. Keyboard and screen-reader users are currently excluded from
  checkout flows.
- **Size:** M
- **Order:** 2
- **Acceptance criteria:** axe reports zero critical/serious violations on the five
  key screens in CI; keyboard-only checkout completes end-to-end; the gate fails
  when a violation is reintroduced.

**2.3 Performance budgets and Core Web Vitals**
- **What:** Add Lighthouse CI (or equivalent) against a built preview with budgets
  for LCP/CLS/INP, JS payload per route and total transfer; measure the storefront
  with and without the 3D viewer; set a bundle-size check in CI.
- **Why:** There is no performance measurement at all today, and `three` +
  `@react-three/*` is a large dependency loaded from a storefront hero.
- **Size:** M
- **Order:** 3
- **Acceptance criteria:** Lighthouse CI runs in the pipeline; LCP budget
  documented and met on the mobile profile; the 3D bundle is proven not to block
  first paint; a regression over budget fails CI.

**2.4 Observability: metrics, dashboards and alerts**
- **What:** Emit metrics for request latency/error rate, payment success/failure
  by provider, webhook processing latency and duplicates, stale reservation count,
  inventory drift and order throughput; create dashboards and alert policies
  (5xx rate, webhook failure rate, job failure, DB health).
- **Why:** The repo documents an uptime probe and "watch the logs" — that does not
  detect a silent payment-webhook outage.
- **Size:** L
- **Order:** 4
- **Acceptance criteria:** Dashboards exist for the four golden signals plus
  payment/webhook KPIs; an induced webhook failure pages/notifies within minutes;
  alert thresholds are documented in the runbook.

**2.5 Shared-store rate limiting and abuse protection**
- **What:** Move `express-rate-limit` to a distributed store (Redis/Upstash or
  Cloud Armor at the edge) and add targeted limits on the payment status and
  webhook endpoints; add bot/abuse protection on auth and checkout.
- **Why:** The default in-memory store means limits are per instance and reset on
  each deploy — trivial to bypass by scaling.
- **Size:** M
- **Order:** 5
- **Acceptance criteria:** Two app instances share the same counters (verified in
  staging); limits survive a deploy; a load test exceeds the limit and receives
  429s.

**2.6 CSP hardening and CSRF modernisation**
- **What:** Remove `'unsafe-eval'` (and, where possible, `'unsafe-inline'`) from
  `scriptSrc` in `server.ts`; replace deprecated `csurf` with a maintained
  double-submit/token implementation; add a test asserting the production CSP and
  security headers.
- **Why:** `'unsafe-eval'` + `'unsafe-inline'` neuters XSS protection, and `csurf`
  1.11.0 is unmaintained (a supply-chain and correctness risk).
- **Size:** M
- **Order:** 6
- **Acceptance criteria:** Production CSP contains no `'unsafe-eval'`; all CSRF
  flows (checkout, shipping, notifications) still pass their tests; a header test
  asserts HSTS, `X-Content-Type-Options`, `X-Frame-Options` and CSP.

**2.7 Client error handling and code-splitting hygiene**
- **What:** Route all client `console.error` paths through `monitoringService`,
  add error boundaries around each major view (storefront, admin, modals), and
  verify chunk splitting keeps the admin bundle out of the customer entry.
- **Why:** Console-only errors are invisible in production, and a single
  unhandled render error currently takes down the entire app.
- **Size:** M
- **Order:** 7
- **Acceptance criteria:** No `console.error` remains in `src/services` and
  `src/repositories` (lint rule or grep check); a forced error in each view
  renders a fallback and reports once; the customer entry bundle does not include
  admin modules.


**2.8 Pay down the data-layer duplication (StoreContext + feature flags)**
- **What:** Decompose `StoreContext.tsx` (935 lines) into focused stores/hooks
  (catalog, cart, wishlist, orders, promos, toasts) and delete the legacy
  `src/repositories/*.ts` duplicates now superseded by
  `repositories/customer/*` and `repositories/admin/*`. Reduce the 14
  `VITE_USE_SUPABASE_*` flags to a single environment-level "live data" switch plus
  per-feature kill switches.
- **Why:** Two parallel data paths double the reasoning cost for every change and
  make the mock path the de-facto tested path.
- **Size:** L
- **Order:** 8
- **Acceptance criteria:** `StoreContext` < 300 lines with no behaviour change
  (Playwright suite still green); no duplicate repository modules remain; the
  feature-flag list is documented and reduced.

**2.9 Contract tests against the payment and carrier sandboxes**
- **What:** Add an opt-in test suite (like the existing
  `PLAYWRIGHT_USE_STAGING_SUPABASE` pattern) that runs against the PayFast sandbox
  and, if shipping is live, The Courier Guy sandbox: initiate, ITN complete/fail,
  replay, refund, rate quote, waybill.
- **Why:** Mock-mode tests prove nothing about the real provider contracts; the
  `scripts/staging/payfast-itn-replay.mjs` script exists but is not wired into CI.
- **Size:** M
- **Order:** 9
- **Acceptance criteria:** The suite runs on demand and in a nightly schedule
  against staging credentials; a documented checklist records the last passing
  run before a production release.

**2.10 Database reliability: rollback scripts, drift detection, seed guards**
- **What:** Add down-migration or documented forward-fix procedures, a CI drift
  check comparing migrations against a fresh local database, and a guard that
  prevents `supabase/seed/02_staging_demo_orders.sql` from running in production.
- **Why:** There is no rollback path and no protection against demo data landing in
  a live database.
- **Size:** M
- **Order:** 10
- **Acceptance criteria:** `supabase db reset` + seed reproduces the schema
  deterministically; the demo-order seed refuses to run when `NODE_ENV=production`;
  a documented rollback procedure is exercised once in staging.

**2.11 Webhook and reconciliation correctness tests (schema-level)**
- **What:** Add tests that drive the full refund/cancel/reconcile paths through
  `webhookService` and the `admin_*` RPCs and assert the resulting rows in
  `orders`, `order_status_history`, `inventory` and `admin_audit_logs`.
- **Why:** The refund path writes `order_status_history` with fields that need
  verification against the migration, and these are the highest-consequence code
  paths in the system.
- **Size:** M
- **Order:** 11
- **Acceptance criteria:** Each state transition has a test asserting the exact
  resulting DB state; the suite runs against local Supabase in CI.

**2.12 API documentation and typed client**
- **What:** Generate/maintain an OpenAPI 3 document for the `/api/*` surface
  (health, ready, csrf, payments, webhooks, shipping, notifications), publish it,
  and derive a typed client or shared contract types used by the frontend.
- **Why:** There is no API documentation at all; the frontend currently
  hand-rolls `fetch` calls to `/api/csrf`, `/api/payments/payfast/initiate` and
  `/api/payments/payfast/status`.
- **Size:** M
- **Order:** 12
- **Acceptance criteria:** The OpenAPI file is generated in CI and fails the build
  if a route changes without a spec update; the frontend uses the typed client for
  at least the payment endpoints.

**2.13 Supply-chain and dependency hygiene**
- **What:** Enable Dependabot (or Renovate) for npm and GitHub Actions, add secret
  scanning (gitleaks/trufflehog) to CI, add container image scanning (Trivy) and
  generate an SBOM per release.
- **Why:** CI only runs `npm audit`; there is no automated update path, no secret
  scanning, and no visibility into the image contents.
- **Size:** M
- **Order:** 13
- **Acceptance criteria:** Dependency PRs are raised automatically; a committed
  fake secret fails CI; each release artifact has an SBOM and a clean image scan.


---

### Phase 3 – Polish & Launch Readiness

> Everything needed for a confident, reversible go-live.

**3.1 Customer account area**
- **What:** Add order history, saved addresses, profile editing and a
  "download invoice/receipt" view; wire it to the existing
  `repositories/customer/orderRepository`.
- **Why:** Today customers can only track an order by code; there is no account
  area, which is table stakes for repeat purchase.
- **Size:** L
- **Order:** 1
- **Acceptance criteria:** A signed-in customer sees all their orders with status
  history; addresses are reusable at checkout; RLS is proven to isolate one
  customer's orders from another's in a test.

**3.2 Server-side search, filtering and pagination**
- **What:** Move catalog search/filter/sort to the database
  (`repositories/customer/productRepository`), with pagination and index-backed
  queries; keep the client-side `filterSneakers` only as an offline/mock path.
- **Why:** The storefront filters the entire in-memory catalog; this does not scale
  past a small catalog and blocks SEO-indexable listing pages.
- **Size:** L
- **Order:** 2
- **Acceptance criteria:** Catalog queries return paginated results under a defined
  latency budget with 10k products in staging; filters and sort match the current
  client behaviour in tests.

**3.3 Reviews and ratings**
- **What:** Add review submission (verified purchase), moderation queue in the
  admin hub, and aggregate `rating`/`reviews_count` updates — the columns and
  indexes already exist in `0003_catalog.sql`.
- **Why:** Rating data is currently only seed data; a shop without reviews loses
  trust signals and SEO.
- **Size:** M
- **Order:** 3
- **Acceptance criteria:** A delivered-order customer can submit a review; it
  appears after moderation; aggregates update and are shown on the product card.

**3.4 SEO completion**
- **What:** Add `robots.txt` and a generated `sitemap.xml`, create the missing
  `og-image-default.png` (referenced by `SEO.tsx` and the crawler interceptor),
  fetch real product data in the `/product/:id` crawler path instead of the
  hardcoded template, and add structured data (Product/BreadcrumbList JSON-LD).
- **Why:** `SEO.tsx` and `server.ts` reference an image that does not exist, and the
  crawler path admits it does not load product data — social previews and Google
  indexing are therefore degraded.
- **Size:** M
- **Order:** 4
- **Acceptance criteria:** `robots.txt` and `sitemap.xml` are served and valid; OG
  image returns 200; a shared product URL produces correct OG tags for a real
  product; JSON-LD validates in the Rich Results test.

**3.5 Rollback, disaster recovery and load rehearsal**
- **What:** Execute the documented rollback (Cloud Run revision revert + DB
  forward-fix), rehearse a PITR restore, and load test the checkout path at the
  expected launch traffic (concurrent checkout on a 1-unit variant, webhook burst,
  admin bulk updates).
- **Why:** `docs/BACKUP_AND_DISASTER_RECOVERY.md` claims RPO < 5 min / RTO < 15
  min but nothing has been exercised; concurrency behaviour is only proven in mock
  mode.
- **Size:** M
- **Order:** 5
- **Acceptance criteria:** A staging rollback is executed end-to-end and timed; a
  PITR restore into a scratch project is verified; load test shows exactly one
  successful order for the last unit and no stock corruption.

**3.6 Independent security review and remediation**
- **What:** Run an external penetration test (or a structured internal review with
  OWASP ASVS checklist) against staging, covering auth, RLS, webhooks, payment
  tampering, file upload, and admin boundary; fix findings by severity.
- **Why:** All existing security evidence is self-generated. An external pass is
  the standard bar before taking payments.
- **Size:** L
- **Order:** 6
- **Acceptance criteria:** A written report exists; all critical/high findings are
  closed and retested; medium findings have owners and dates.

**3.7 Documentation consolidation and on-call readiness**
- **What:** Rewrite `README.md` as a real onboarding guide, consolidate the 15+
  docs into a small navigable set (architecture, local dev, environments,
  deployment, runbook, incidents), and define an on-call/incident process with
  severity levels and a contact path.
- **Why:** Knowledge is currently scattered and partly stale; a new engineer cannot
  onboard from the README.
- **Size:** M
- **Order:** 7
- **Acceptance criteria:** A new contributor can clone, run, test and deploy to
  staging using only the README and linked docs; the incident process names owners
  and escalation paths.

**3.8 Launch checklist and go/no-go evidence pack**
- **What:** Convert `QA_STLC_CHECKLIST.md` and `PRODUCTION_LAUNCH.md` into a single
  evidence-backed launch checklist (each item linked to a passing test, log,
  screenshot or report), with named sign-off and a dated decision.
- **Why:** The existing checklist is unchecked boxes; the go/no-go decision needs
  evidence, not intent.
- **Size:** S
- **Order:** 8
- **Acceptance criteria:** Every launch item links to evidence; the pack is
  reviewed by an owner who did not write it; the go/no-go decision is recorded.

**3.9 Final production configuration freeze**
- **What:** Provision the production Supabase project, PayFast live credentials,
  Resend domain (SPF/DKIM/DMARC as described in `PRODUCTION_LAUNCH.md`), Cloudflare
  TLS Full (Strict) and cache rules, and verify `CUSTOMER_ORIGIN`/`ADMIN_ORIGIN`/
  `CORS_ALLOWED_ORIGINS` resolve correctly. Verify no staging credentials leak into
  production.
- **Why:** The audit doc lists live configuration as "NOT VERIFIED"; this closes it
  with proof.
- **Size:** M
- **Order:** 9
- **Acceptance criteria:** A production smoke run passes (health, ready, storefront,
  admin login, sandbox→live payment on a test order, webhook received); staging and
  production use separate Supabase projects and keys.


---

### Phase 4 – Post-Launch Improvements

> Valuable, but only after the shop is live and stable.

**4.1 Real analytics and funnel reporting**
- **What:** Replace the `console.log` stub in `src/services/analyticsService.ts`
  with a real provider (or a first-party endpoint), consent-gated, and build
  funnel dashboards (product view → add to cart → checkout start → purchase).
- **Why:** Business decisions currently have no data; the service claims to be a
  production analytics abstraction but only logs.
- **Size:** M
- **Order:** 1
- **Acceptance criteria:** Events land in the analytics store with consent
  respected; funnel conversion is visible for a real day of traffic.

**4.2 Inventory forecasting and low-stock automation**
- **What:** Use `sales_count`, reservations and drop dates to surface low-stock
  alerts, reorder suggestions and auto-pause of sold-out variants.
- **Why:** `docs/PRODUCTION_PHASES.md` already lists low-stock alerts as planned;
  manual stock management will not scale.
- **Size:** M
- **Order:** 2
- **Acceptance criteria:** Admin sees a low-stock list with thresholds; an alert
  fires before a variant sells out unexpectedly.

**4.3 Multi-currency and a real tax engine**
- **What:** Replace the hardcoded ZAR + `tax = 0.00` behaviour in
  `place_order_atomic` with configurable VAT/tax rules and (if needed) multi-currency
  pricing.
- **Why:** Any expansion beyond ZAR/zero-tax requires a schema and pricing change
  that is cheaper to design now than after launch.
- **Size:** L
- **Order:** 3
- **Acceptance criteria:** Tax is computed per configured jurisdiction and shown on
  the order, receipt and admin view; totals remain server-authoritative.

**4.4 Offline-first cart and push notifications**
- **What:** Register a service worker with an offline cart queue (IndexedDB) and
  sync-on-reconnect, plus optional web-push for drop and shipping updates.
- **Why:** Listed in `docs/PRODUCTION_PHASES.md` and genuinely useful for a
  mobile-first sneaker drop audience.
- **Size:** L
- **Order:** 4
- **Acceptance criteria:** Cart survives an offline session and syncs; a drop
  notification can be subscribed and delivered.

**4.5 Granular admin RBAC and audit UI**
- **What:** Expose `super_admin` vs `admin` capabilities in the UI, add an admin
  audit-log viewer (the `admin_audit_logs_for_admin` RPC and
  `hooks/admin/useAdminAudit.ts` already exist), and require re-authentication for
  destructive actions.
- **Why:** The role model exists in code but is not surfaced; privileged actions
  should be reviewable.
- **Size:** M
- **Order:** 5
- **Acceptance criteria:** Audit entries are visible and filterable in the admin
  hub; role changes and refunds require confirmation and are logged.

**4.6 Separate deployment for the admin surface**
- **What:** Move the admin SPA to its own build/deploy target so the customer
  bundle never contains admin code, and serve it only from `admin.kixora.com`.
- **Why:** Closes the residual risk from client-side-only admin isolation and
  shrinks the customer bundle.
- **Size:** L
- **Order:** 6
- **Acceptance criteria:** The customer bundle contains no admin modules; the admin
  app is deployed independently and unreachable from the customer origin.

**4.7 Loyalty, referrals and wishlist sharing**
- **What:** Build on the existing wishlist and drops features with referral codes,
  loyalty points and shareable wishlists.
- **Why:** Growth features once the core commerce loop is stable.
- **Size:** L
- **Order:** 7
- **Acceptance criteria:** A referral generates a trackable discount; a shared
  wishlist link works for a guest.

**4.8 Cost and reliability optimisation**
- **What:** Right-size Cloud Run instances, add CDN caching for catalog reads,
  review Supabase plan limits (connections, storage, egress) and set budget alerts.
- **Why:** Post-launch traffic reveals the real cost profile.
- **Size:** M
- **Order:** 8
- **Acceptance criteria:** Monthly cost per order is measured; budget alerts exist;
  no scaling limit is hit at 3× current peak.

**4.9 Accessibility certification and internationalisation**
- **What:** Complete a WCAG 2.2 AA audit and add i18n scaffolding if expansion is
  planned.
- **Why:** Phase 2 sets the floor; certification and localisation are deliberate
  projects.
- **Size:** L
- **Order:** 9
- **Acceptance criteria:** An accessibility statement is published; all audited
  flows pass WCAG 2.2 AA; strings are externalised if i18n is pursued.


---

# 7. Top 5 highest-risk items

| # | Risk | Why it is the highest risk | Where |
| --- | --- | --- | --- |
| 1 | **Shipping cannot run in production, yet checkout implies it works** | `ShippingService.calculateRates`/`createShipmentLabel` throw when `NODE_ENV === 'production'`, and `TheCourierGuyDriver` returns hardcoded rates. Every production checkout would fail or silently use invented prices, and the launch smoke tests cannot pass. | `src/services/shipping/shippingService.ts:38-40, 57-59`, `src/services/shipping/carrierDrivers.ts` |
| 2 | **No error tracking and no top-level error boundary** | `monitoringService.dispatchToSentry` POSTs raw JSON to the DSN (not the Sentry envelope API) and no `@sentry/*` package is installed, so production failures are invisible; a single render error blanks the whole storefront with no report. | `src/services/monitoringService.ts:18-31`, `src/App.tsx` |
| 3 | **Account recovery does not exist** | There is no password reset, forgot-password or email-verification flow anywhere, and `enable_confirmations = false`. Any customer who forgets a password is permanently locked out of paid orders. | grep for `resetPassword`/`forgot` returns nothing; `supabase/config.toml` |
| 4 | **Stale orders and reservations are never cleaned up automatically** | `cleanup_stale_pending_orders()` / `cleanup_expired_reservations()` exist but nothing schedules them (no `pg_cron`, no job, no worker). Abandoned checkouts permanently hold stock and inventory under-sells with no signal. | `supabase/migrations/0009_functions.sql`, `0016_reconciliation_refinements.sql`, `src/services/adminOrderService.ts:146` |
| 5 | **No refunds, plus a red test suite and near-zero coverage on money paths** | `processRefund` returns `success: false`; two unit tests fail today; coverage thresholds are 2%/4%/1%/2% over 6 files, so payment, webhook and inventory logic has no unit-level safety net. Money-handling code is both incomplete and unproven. | `src/services/payments/payfastDriver.ts:177-193`, `vitest.config.ts`, `npm run test` output |

**Honourable mentions (not in the top 5, but real):** the client-only admin domain
guard plus the `VITE_PLAYWRIGHT_ADMIN` escape hatch; the in-memory rate limiter;
`csurf` being unmaintained; the manifest/PNG-icon mismatch that makes the documented
PWA install fake; and the doc-vs-code drift on static caching.

---

# 8. Recommended starting point

**Start with Phase 0 items 0.1 and 0.2: make the test suite green and make
`npm run release:gate` pass.**

Concretely, the very first task is:

> Decide the intended production behaviour for the shipping service (throw vs.
> fallback) and for the PWA icons, make the code and `manifest.json` agree, then get
> `npm run test` to 0 failures and `npm run release:gate` to exit 0 on the current
> commit.

**Why this first:**
1. Every later phase depends on a trustworthy gate. Right now the suite is red, so
   "the tests pass" is not a statement anyone can make.
2. Both failures are decisions disguised as bugs — resolving them forces the team to
   state what the product actually promises (does shipping exist? is the PWA real?).
   That answers the two biggest scope questions in Phase 1.
3. It is small (S), unblocks CI for every subsequent change, and produces the first
   honest green baseline.

Immediately after that, do **Phase 0 items 0.3 and 0.7** (remove the admin bypass
and fail the build when the mock data path is active in production) — these are the
two remaining "the environment could silently betray you" risks.


---

# 9. Overall project health summary

**Verdict: NEEDS WORK — with HIGH RISK concentrated in payments, fulfilment and
observability.**

**What is genuinely good (and better than a typical pre-production repo):**
- A real layered architecture: components → hooks → repositories → services →
  Supabase RPCs, with typed domain models.
- A serious, well-designed database: 33 migrations, normalised catalog, inventory
  with reservations, immutable orders, status history, audit logs, webhook events,
  RLS on tables and storage, and `SECURITY DEFINER` RPCs that recompute prices
  server-side and lock rows — the strongest part of the codebase.
- Security middleware that actually exists and fails closed: CORS allowlist, CSRF,
  rate limiting, Helmet/CSP, webhook signature verification with replay windows,
  idempotent webhook claiming, amount and currency validation on settlement, and PII
  masking in logs.
- Payment-mode guardrails: mock payments are structurally prohibited in production
  builds, and PayFast signature/ITN verification is implemented rather than stubbed.
- A broad test surface (47 unit/component + 165 Playwright specs), a release gate,
  and four CI workflows including staging and production Cloud Run deploys.
- Honest, detailed ops documentation and an audit document that already says "not
  production-ready" for largely the right reasons.

**What makes it "needs work":**
- The money paths are incomplete: no refunds, no automatic reservation cleanup, and
  shipping that literally cannot run in production.
- The operational safety net is missing: no working error tracking, no metrics,
  alerts or dashboards, and no top-level client error boundary.
- Customer-critical flows are absent: password reset, email verification, account
  area, reviews, legal pages.
- Testing is broad but shallow and currently red; coverage on services and
  repositories is effectively unmeasured.
- Documentation overstates readiness in several places (static caching, PWA, Sentry,
  carrier integration), which is the most dangerous kind of debt.

**Rough effort shape:** Phase 0 is small and mostly decision-making. Phase 1 is the
heavy lift and contains the true go-live blockers (shipping, refunds, scheduled
jobs, error tracking, auth recovery, validation, legal). Phases 2–3 convert "it
works on staging" into "we can prove it and recover from it". Phase 4 is growth.

**Bottom line:** The foundation and the database are strong enough to build on — do
not rewrite them. But do not take real payments until the shipping decision is
made, refunds exist, stale stock is cleaned automatically, errors are visible, and
customers can recover their accounts.


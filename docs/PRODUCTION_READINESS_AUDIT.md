# Kixora Production Readiness Audit

**Assessment date:** 2026-10-03  
**Status:** NOT PRODUCTION READY  
**Initial audit mode:** Read-only inspection of GitHub source and CI, Supabase production/staging metadata and security advisors, and Render service/deploy/log metadata. No production data was read beyond schema/catalog metadata. No live exploit was attempted. The subsequent completion-work iteration adds a scoped app/migration/test change on this branch; it has not been applied to either live database or deployed.

## Executive summary

Kixora has a credible modern web stack and useful baseline controls. Live evidence shows critical payment/order integrity defects in exposed Postgres functions, failed staging deployments, a red CI pipeline, and production/staging database drift. Readiness is **15/100** (judgment score; category scores in the final report). Do not enable real-money production checkout until P0/P1 findings are fixed and verified.

The most consequential defect is public-schema function confirm_inventory_sale(uuid,text): a SECURITY DEFINER function executable by anon and authenticated roles, without its own payment verification or trusted caller check, can mark an order paid and mutate inventory. cleanup_stale_pending_orders(integer) is also callable by those roles and accepts a caller-selected TTL for cancellation. These direct database RPC surfaces bypass frontend and HTTP webhook protections.

The staging PayFast ITN route does send notifications to PayFast’s environment-specific validation endpoint and requires response VALID before processing. This is positive, but does not protect the direct RPC bypass. PayFast’s [official ITN documentation](https://developers.payfast.co.za/docs/itn-instant-transaction-notification/) describes signature, source, expected amount, and server confirmation checks.

### Critical blockers

1. **Callable database mutations:** 17 SECURITY DEFINER functions per database can be called by anon. Includes payment confirmation, pending-order cleanup, reservation release and guest-order lookup. Most also have mutable/unpinned search_path.
2. **Production DB drift:** confirmed production project My Project (gyebplbyzxzdpupuixdt) is through migration 0027; staging (gzxhgeudovbdpgbvzwoa) has baseline/grant migrations after 0029. Production has RLS disabled on public.payment_reconciliation_logs.
3. **Staging down:** latest observed Render deploys fail startup due missing VITE_PUBLIC_SITE_URL. Neither service has a configured health-check path; metrics API returned no data.
4. **CI red:** latest observed PR #22 browser suite is 154 passed, 10 failed, 1 skipped; dependency audit found five high findings. Build skipped after Playwright failed.
5. **Reflected script injection:** crawler route interpolates a product path parameter into inline JavaScript; CSP permits unsafe-inline and unsafe-eval.

## Scope and evidence

- GitHub private repo kix6ora/Kixora; main at 7768759101f95ad4f1124d53a518a32c687e5e60. PR #22 branch staging/payfast-checkout at e142e1a98f7ca7cd3501393310cabc9f77e33a15, open and mergeable at inspection.
- Supabase: production project name confirmed by user. Both projects healthy, Postgres 17.6, eu-west-1. Read-only migration history, catalog/RLS/function ACL metadata, security/performance advisors and selected function definitions were reviewed.
- Render: only connected workspace was Mandla’s workspace. It returned two staging services, no production Render service or Render Postgres. This is only evidence for the connected workspace, not proof none exists elsewhere.
- Remote GitHub Actions results/logs reviewed; this audit did not run tests locally.
- Excluded: no prod login/checkout, live payment, personal order data, backup/restore, or custom domain validation. Backup retention, RPO/RTO, prod hosting outside connected workspace and customer/admin UX remain unverified.

## Architecture and stack

| Area | Observed |
|---|---|
| UI | React 18, TypeScript, Vite, Tailwind 3; customer storefront and admin |
| API | Express 5, Node 22; esbuild bundles server to dist/server.cjs; server hosts static frontend |
| Data/auth | Supabase JS 2.49.1, Supabase Postgres 17 and Auth |
| Payments | PayFast; client configuration supports mock mode, production env validation requires PayFast |
| Shipping | The Courier Guy settings and tracking webhook integration are present; live carrier status unverified |
| Media/email | Cloudinary and Resend configuration |
| QA/CI | GitHub Actions, Vitest, Playwright, axe-core, local Supabase migration gate, npm audit |
| Hosting seen | Two Render staging web services; no production service visible in connected workspace |
| IaC | No complete verified production infrastructure definition in evidence reviewed |

Declared versions from package.json include React ^18.3.1, Express ^5.2.1, Supabase JS ^2.49.1, Vite 6.4.3 override, Tailwind ^3.4.17, Vitest 4.1.11, Playwright ^1.63.0, TypeScript ^5.7.3. Lock-resolved inventory/support status was not independently refreshed.

## Security and database

Both projects contain 27 public base tables and 36 foreign keys. All have at least one index. Production advisor reports 17 unindexed FK constraints; catalog query found 13, so reconcile advisor coverage and actual index semantics before changes.

| Live metadata | Production | Staging |
|---|---:|---:|
| RLS-disabled tables | 1: payment_reconciliation_logs | 0 |
| SECURITY DEFINER functions | 18 | 19 |
| Definer functions executable by anon | 17 | 17 |
| Definer functions executable by authenticated | 17 | 18 |
| Mutable search-path warnings | 17 | 19 |

Production anon/authenticated table grants for payment_reconciliation_logs deny SELECT/INSERT, lowering immediate REST exposure, but RLS-off still violates defense-in-depth and migration intent. webhook_events has RLS with no policies in both databases; this is default deny for ordinary roles but should be explicitly treated as service-only.

### High-risk functions

- confirm_inventory_sale(order_id,payment_reference): callable by anon/authenticated; marks an arbitrary order paid, confirms reservations/decrements inventory and trusts caller reference. No independent verified-payment condition.
- cleanup_stale_pending_orders(ttl): callable by both roles; caller-supplied TTL can broaden cancellation to current pending orders.
- release_order_reservations(order_id,reason): public execute. Production checks paid state; inspected staging function lacks equivalent guard.
- create_pending_order_atomic and place_order_atomic: when auth.uid() is absent, use supplied p_user_id, enabling anonymous victim-attributed order/reservation creation.
- get_guest_order_secure(order_code,token_or_email): accepts customer email as alternative to a guest token and returns customer snapshot/history/shipment. Order functions use a short numeric suffix in order codes; email plus guessable identifier is weak authorization.
- Admin RPCs have internal is_admin checks, a useful layer, but are unnecessarily executable by public roles; some accept caller-supplied actor IDs.
- Security advisor reports 17 anon-callable SECURITY DEFINER functions per DB. Most have mutable search_path, increasing object-shadowing risk.

RLS metadata was reviewed, but no role-by-role adversarial matrix was executed. Do not describe RLS isolation as penetration-tested.

### Application perimeter

server.ts includes explicit production CORS allowlist validation, Helmet headers, CSRF middleware for payment/shipping/notification groups, payload limits, and IP-based rate limiters. Positive controls, but they do not replace authorization.

CSP still permits inline/eval. Product crawler route inserts the path id into a JavaScript redirect. Remove script interpolation or encode safely and tighten CSP; test quotes/script breakout.

PayFast webhook has passphrase presence check, raw body, PayFast server postback requiring VALID, and delegated signature/idempotency/order reconciliation. Valid-source check was not evident. More critically, database RPC directly bypasses the HTTP checks.

No credential values were retrieved or included. Render logs showed missing variable names only.

## Commerce and operations

- Checkout/order RPCs are atomic, but public permissions and guest attribution undermine integrity. Full lifecycle was not independently executed.
- PayFast server checkout and provider ITN validation exist on PR branch. Refund driver explicitly does not perform a refund; refund lifecycle is incomplete.
- Inventory reserve/release/confirm requires authorization, legal transition, idempotency and concurrency tests. CI has inventory regression failures.
- Shipping APIs exist; carrier credentials, label purchase/cost controls and tracking lifecycle were not verified. Confirm admin/service auth on all shipping/notification handlers.
- Admin product/inventory E2E tests time out on selectors. Frontend route isolation does not prove backend isolation.
- Guest order details include customer data under weak credentials. Retention/deletion and privacy notice unverified.
- Structured logs and health routes exist; request correlation, central error tracking, metrics, alerting and security event retention not evidenced.
- Performance advisor reports 17 unindexed FK constraints. No load, query-plan, bundle-size or response-time measurements.
- axe and crawler tooling exists; accessible outcomes, metadata/canonical/schema coverage not measured.
- Backup settings and restore drill not verified.

## QA and dependencies

Workflow design includes npm ci, local Supabase startup/migration gate, typecheck, ESLint, unit/component coverage, Playwright, build and separate npm audit.

Latest observed PR #22 results:
- Typecheck, lint and unit/component stage passed.
- Playwright: **154 passed, 10 failed, 1 skipped**. Failures: six admin selectors, mock-mode production expectation, two admin product/inventory cases and one production config security test.
- Build skipped following Playwright failure.
- npm audit failed on **five high** transitive findings involving braces/chokidar/fast-glob/micromatch/Tailwind 3.4.19. Forced Tailwind v4 upgrade is breaking according to CI output; use a compatible remediation.
- Latest main CI also failed. Prior AI docs and old test claims are not current evidence.

## Deployment and release strategy

Render returned storefront Kixora-staging (srv-db05hdqd0e5s73a6el5g) and admin kixora-admin-staging (srv-db05ifhsrm7s73e6bnog). Both are Frankfurt/free/one instance, auto-deploy staging/payfast-checkout, no health path, public onrender.com hostname enabled, no PR preview. Latest deploys update_failed; build succeeded but startup failed missing VITE_PUBLIC_SITE_URL. Metrics were empty. No production Render service appeared in connected workspace; do not infer a production deployment exists.

Release strategy: keep production unchanged; fix P0 function authorization; reconcile forward migrations; harden XSS/auth/RPC boundaries; repair CI and dependency findings; verify role/payment/order/inventory behavior in disposable staging; demonstrate restore, rollback and alerting; then request a separate production go/no-go. No deployment approval was granted.


## Completion-work update (2026-10-04)

The first P0 remediation slice is included on production-hardening: server-only service-role webhook reconciliation, revocation of direct anonymous/authenticated payment confirmation and reservation release, admin/service-role bounded stale-order cleanup, production service-key validation, and migration regression checks. Local lint/typecheck, build, 18 Vitest tests, and in-memory migration/integrity validation passed. The database validator now checks permission-statement forms that its SQL AST parser cannot parse. Live PostgreSQL/Supabase role tests remain unverified because local Supabase/Docker could not start in this sandbox; no production migration was applied. P0 findings remain OPEN pending real isolated-role verification.

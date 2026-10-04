# Kixora Completion Workflow

Master dependency-aware roadmap from the 2026-10-04 baseline. Status is evidence-based and must only move to complete after exit criteria pass. Current result remains **NOT PRODUCTION READY**.

## Progress

- [✓] Phase 0 — inspect repository, architecture, live DB/deployment evidence, baseline CI and local build/lint/unit baseline. Evidence and environment limitations recorded in BASELINE_STATUS.md and PRODUCTION_READINESS_AUDIT.md.
- [~] Phase 1 — payment/RPC trust boundary. Authenticated admin/service-only cleanup; service-role webhook data access; no anonymous payment-confirm RPC. Migration and regression checks are included in production-hardening; remote Postgres/RLS validation remains required before closing.
- [~] Phase 2 — database/RLS and identity isolation. Guest checkout cannot attach an unauthenticated order to an arbitrary account; email alone no longer authorizes guest order retrieval; legacy order RPC revoked. Full RLS role matrix, all SECURITY DEFINER grants/search paths, and forward migration execution remain open.
- [ ] Phase 3 — auth lifecycle and admin/customer authorization.
- [ ] Phase 4 — product/catalog, cart and server-authoritative checkout.
- [ ] Phase 5 — PayFast, refunds, idempotency, inventory concurrency and order lifecycle.
- [ ] Phase 6 — admin/API authorization, validation and abuse controls.
- [ ] Phase 7 — customer/admin end-to-end journeys and negative testing.
- [ ] Phase 8 — dependency, performance, accessibility, SEO and observability.
- [ ] Phase 9 — CI/deploy, backup restore, rollback, final production gate.

## Phase 0 — Repository baseline (COMPLETE WITH LIMITATIONS)

**Current state:** React/Vite/TypeScript client, Express 5 server, Supabase Auth/Postgres/RPC, PayFast, Cloudinary, The Courier Guy, Resend; Render staging returned two failed services. Local source was e71e3e4, a direct ancestor of audited main. Local runtime Node 26.9 rather than CI Node 22.

**Evidence/files:** package.json and lock, src/, server.ts, supabase/migrations, tests/, scripts, .github/workflows, docs, live production/staging Supabase metadata and connected Render logs.

**Baseline:** npm ci/build/lint succeeded; Vitest 18 pass on the previous hardening slice using runner-based loader; Playwright could not start locally due OS user-info ENOMEM; remote PR suite was 154 pass / 10 fail / 1 skipped; five high npm findings; local Supabase gate skipped because Docker unavailable; latest in-memory DB validation passed 33 migration files and commerce checks but is not live Postgres.

**Exit:** baseline limitations recorded, current test/runtime/version/DB/deploy source snapshots identified, no previous-report claims substituted for new evidence. Baseline record: BASELINE_STATUS.md.

## Phase 1 — Payment and order RPC boundary (IN PROGRESS, P0)

**Current state/problems:** confirm_inventory_sale and cleanup_stale_pending_orders were callable by anon/authenticated; release_order_reservations was public; webhookService used the anon client for trusted payment-state operations. Migration 0032 and server-side webhook client address these paths, pending Node 22 CI and real Postgres role validation.

**Dependencies/files:** server-only SUPABASE_SERVICE_ROLE_KEY, src/lib/supabaseAdmin.ts, src/services/webhookService.ts, src/config/env.ts, migrations 0032 onward, Supabase roles/PostgREST.

**Tasks:** revoke public payment confirmation/release; grant service role; authorize cleanup inside the function and bound TTL; pin search paths; use service client in webhook reconciliation; require service key at production startup; add regression checks.

**Tests:** migration ACL/path check; admin/customer/anon/service role tests against disposable Postgres; valid, invalid, duplicate and concurrent PayFast ITN tests; confirm non-admin cleanup rejection and boundary TTL.

**Acceptance/exit:** actual anon and customer cannot confirm/release or run cleanup; admin can clean only bounded stale orders; server role can reconcile only after provider validation; idempotency and order/inventory transaction behavior verified. Local static/unit/build checks pass; until live DB checks pass, P0 remains OPEN.

## Phase 2 — Database schema, RLS and user identity (P1)

**Current state/problems:** prod behind migrations; payment_reconciliation_logs RLS off; 17 anon-callable definer functions; mutable search paths; guest lookup accepted email as credential; guest RPCs trusted p_user_id fallback; 17 unindexed-FK advisories. Migration 0033 addresses the guest credential and account-assignment paths; remaining grants, search paths, RLS, and migration-ledger work remain open.

**Dependencies/files:** supabase/migrations/0001–0032, all public RPCs and policies, src/repositories/orderRepository.ts, guest order/tracking views.

**Tasks:** enumerate exact grants and callers; close each RPC by purpose; derive identity from auth.uid or high-entropy guest capability; align production/staging forward migrations; RLS/policy matrix; reconcile index recommendations from query plans.

**Tests:** anonymous, customer, admin, altered claims and service role against disposable Supabase; cross-account profile/order/cart/shipment attempts; direct RPC calls; schema migration diff and constraint checks.

**Acceptance/exit:** zero unintended public SECURITY DEFINER execute; pinned search paths; production schema ledger is aligned; ownership tests pass; no email+guessable-code access; no destructive migration.

## Phase 3 — Authentication and admin authorization (P1)

**Current state/problems:** Supabase Auth/hooks and admin route components exist; full register/login/logout/reset/expiry lifecycle and admin APIs are not verified. Admin E2E selectors currently fail.

**Dependencies/files:** src/services/authService.ts, src/hooks/useAuth.ts, src/routes/*, src/services/admin*, RLS helpers/triggers.

**Tasks:** trace lifecycle, role source and JWT refresh; prove server-side admin boundary for every route/RPC; review admin role mutation and session refresh.

**Tests:** lifecycle and expiry, customer→admin escalation, forged claims, horizontal IDOR, direct API/RPC, unauthorized and revoked sessions.

**Acceptance/exit:** all customer/admin isolation tests pass; no frontend-only authorization; roles derive from trusted app metadata/profile sync; full admin journeys pass.

## Phase 4 — Catalog, cart and checkout foundation (P1)

**Current state/problems:** catalog/search/filter/product, variants, wishlist, cart and checkout code exist; product/cart journey and price/stock changes not end-to-end verified. Client stock preview includes a stub.

**Dependencies/files:** src/repositories/*, src/context/StoreContext.tsx, catalog/cart/checkout components, checkoutService, price/inventory/promo RPCs.

**Tasks:** verify variants/prices/media/status; validate all totals and promos at server/database; reject stale/out-of-stock/changed-price carts; make retries deterministic.

**Tests:** catalog search/filter/sort, size availability, wishlist, cart persistence/auth transition, price change, promo failure, duplicate submit, network failure, mobile viewport.

**Acceptance/exit:** server-calculated totals match displayed breakdown; no client cart tampering changes payable amount; stale/stock failures recover cleanly.

## Phase 5 — PayFast, inventory, orders and fulfillment (P0/P1)

**Current state/problems:** PayFast server initiation/ITN postback and durable idempotency exist on staging path; RPC boundary is under hardening. Refund driver is unimplemented; concurrency and complete order lifecycle not proven.

**Dependencies/files:** src/services/payments/*, webhookService, migrations, checkout/fulfillment/shipping modules, order state model.

**Tasks:** complete provider validation/replay semantics; reconcile payment/order atomically; implement or document controlled refund path; verify reserve/confirm/release state matrix and shipment transitions.

**Tests:** valid/forged/mismatched/unknown/duplicate/out-of-order webhooks; final-unit concurrent checkout; duplicate checkout; fail/cancel/refund/partial fulfilment and recovery.

**Acceptance/exit:** provider-confirmed server status only; exactly-once durable mutations; no negative stock/oversell; order/payment/inventory/shipment states reconcile; refunds are supported or formally excluded.

## Phase 6 — Admin/API and security hardening (P1)

**Current state/problems:** Express has Helmet/CORS/CSRF/rate limit/body limits; XSS risk in crawler HTML; shipping-label and order-email routes now require a verified Supabase user and admin/super-admin profile role (CI verification pending); environment failures cause staging startup abort.

**Dependencies/files:** server.ts, env.ts, admin services, shipping/email services, CSP/CORS/cookies, upload configuration.

**Tasks:** remove inline redirect injection; verify authz for every endpoint; validate schema/IDs/recipient/amount; assess upload and SSRF surface; ensure secret/PII redaction; define env contract.

**Tests:** API endpoint matrix, encoded XSS, malicious URLs/files, CSRF/CORS, limits/rates, external service timeout/failure, unauthenticated/customer/admin role cases.

**Acceptance/exit:** no P0/P1 perimeter defects; consistent error behavior, safe output, enforced auth and bounded external side effects.

## Phase 7 — Functional E2E and reliability (P1)

**Current state/problems:** remote browser suite has 10 failures and one skip; local browser suite could not start due Node 26 sandbox user-info failure.

**Dependencies/files:** tests/e2e, tests/admin, tests/security, Playwright configuration, test fixtures.

**Tasks:** run on intended Node 22 in CI; fix root causes without deleting valid coverage; add customer/admin journeys and negative paths; eliminate tests that only assert mocks/placeholders where real integration is required.

**Acceptance/exit:** browser journeys for storefront, catalog, auth, cart, checkout, payment, orders/tracking and admin all pass on deterministic isolated test services; failed/skipped tests explained.

## Phase 8 — Dependencies, performance, accessibility, SEO, observability (P2)

**Current state/problems:** five high dependency findings; Three.js vendor bundle is 1.17 MB raw/328 KB gzip; 17 FK index advisories; empty Render metrics; accessibility/SEO/alerting unverified.

**Dependencies/files:** package.json/lock, Vite chunking, SQL indexes, SEO component/crawler, axe tests, server logs/metrics.

**Tasks:** compatible dependency updates; measure critical DB and frontend paths; justify indexes with query plans; improve code splitting/assets; WCAG-aware audits; metadata/canonical/sitemap/private admin crawl checks; request IDs, alerts and redaction.

**Acceptance/exit:** no unresolved high/critical advisories or approved exception; measurable budgets; critical accessibility/SEO checks pass; actionable monitored error/payment/order health.

## Phase 9 — CI, deployment, recovery and final gate (P0/P1)

**Current state/problems:** CI red; staging deploy fails for VITE_PUBLIC_SITE_URL; no Render health path; production host absent in connected workspace; backup/restore/RPO/RTO unknown.

**Dependencies/files:** .github/workflows, Render settings/Blueprint, env example, docs/runbook/DR and owner evidence.

**Tasks:** green Node 22 clean pipeline; enforce release checks; verify staging service/env/readiness/rollback; reconcile schema before production; verify backup and restore in isolation; establish runbooks/alerts/contacts.

**Acceptance/exit:** install/lint/typecheck/unit/integration/E2E/security/build green; intended staging deploy healthy on pinned SHA; rollback and recovery drills documented with approved RPO/RTO; all P0/P1 closed.

## Release rule

Production remains **NO-GO** until every phase exit criterion required for the actual enabled feature set is evidenced and an independent review closes all P0/P1 findings. Test doubles, in-memory PostgreSQL and remote CI summaries do not substitute for live isolated role/payment/recovery validation. No workflow step authorizes a production deploy or secret rotation by itself.


# Kixora Production Remediation Plan

**Baseline:** 2026-10-03 audit of main 7768759101f95ad4f1124d53a518a32c687e5e60, staging PR head e142e1a98f7ca7cd3501393310cabc9f77e33a15, confirmed Supabase production/staging metadata, Render staging and GitHub Actions.  
**Status:** Every item is OPEN / NOT IMPLEMENTED. No code or infrastructure fixes were made.

Severity: P0 production blocker/catastrophic; P1 critical; P2 high; P3 medium; P4 low.

| ID | Sev/category | Affected area | Impact and root cause | Recommended fix | Verification / status |
|---|---|---|---|---|---|
| DB-01 | P0 payment/RPC | confirm_inventory_sale; migrations 0009 and payment hardening | Anon/authenticated can invoke definer to mark arbitrary orders paid and decrement stock using supplied reference; no internal trusted-payment guard. | Revoke PUBLIC/anon/auth execute; service-role only/private schema; pin search_path; enforce legal prior states and server-verified payment context, idempotently. | ACL assertions, anon/customer denial, verified sandbox ITN, replay/amount/currency/order tests. OPEN |
| DB-02 | P0 order integrity | cleanup_stale_pending_orders | Public definer accepts arbitrary TTL and can cancel pending orders. | Service-role only; bounded TTL in private scheduled job; pin path and audit actor/count. | Anon/customer denied; job cancels only configured stale records. OPEN |
| DB-03 | P1 function security | All public SECURITY DEFINER functions, both DBs | 17 callable by anon per DB; mutable paths reported on 17/19 functions; broad function API. | Inventory signatures; revoke default grants; invoker where possible; pin trusted search path/schema qualify; explicit least-privilege grants. | Compare ACL/path inventory and test anon/customer/admin/service roles. OPEN |
| ORD-04 | P1 privacy | get_guest_order_secure and order code generation | Email plus short numeric code grants customer/shipment snapshot access. | Require high-entropy guest capability; remove email authentication; minimize fields; rate limit. | Cross-order, brute-force and email-only denial tests. OPEN |
| ORD-05 | P1 attribution | create_pending_order_atomic, place_order_atomic | Anonymous RPC fallback trusts supplied p_user_id. | Derive signed-in ID from auth.uid(); anon cannot assign a user ID; use explicit guest capability. | Cannot create order/reservation attributed to another user. OPEN |
| INV-06 | P1 state/concurrency | release_order_reservations | Public execute; staging body lacks paid-order guard seen in production. | Restrict callers; atomic state matrix; ensure paid/refund-safe, idempotent release. | Paid cannot release; concurrent/repeated operations safe in tests. OPEN |
| DB-07 | P1 drift/RLS | Prod migration ledger; payment_reconciliation_logs; migrations 0030/0031 | Prod only through 0027; RLS disabled on reconciliation table. Grants currently deny anon/auth select/insert but drift remains. | Reconcile migration names/history; reviewed forward-only migration after staging; enable RLS and exact least grants. | Migration ledger/schema/grants match intent; negative REST tests. OPEN |
| APP-08 | P1 XSS/CSP | server.ts crawler route and Helmet CSP | Path id enters inline JS; CSP permits inline/eval. | Remove inline redirect, safe canonical metadata and tighten CSP. | Encoded quote/script payload browser tests and CSP checks. OPEN |
| API-09 | P1 authorization | server.ts shipping labels and order-confirmation email | CSRF is not authorization; endpoint authorization was not established by static evidence. Potential label/email abuse. | Confirm admin/service identity, order ownership, content/recipient validation, cost limits and audit. | Anonymous/customer direct requests denied; authorized admin tests. OPEN |
| RUN-10 | P1 runtime | Render staging, env validation | Latest deploys fail on missing VITE_PUBLIC_SITE_URL; no health path. | Canonical environment matrix, configure provider values by approved owner, add preflight and readiness path. | Both staging services healthy on intended SHA; readiness checked. OPEN |
| CI-11 | P1 QA | Admin/phaseB/security Playwright suite | 10 failures in latest PR run; production build skipped. | Fix root causes; preserve tests; split build as independently required job. | Full green CI; artifact includes totals and skip reasons. OPEN |
| DEP-12 | P1 dependencies | package.json/lockfile, CI | Five high audit advisories; forced Tailwind 4 is breaking. | Review resolved dependency tree and upgrade compatible parent/transitive versions; lockfile review. | Clean install and no high/critical, or approved bounded exception. OPEN |
| PAY-13 | P1/P2 payment | PayFast webhook and RPC | Server postback VALID is present but direct RPC bypasses it; valid-source check not evident. | After DB fix, complete signature/source/amount/currency/order/postback/replay checks. | Sandbox valid and forged/invalid cases. OPEN |
| PAY-14 | P2 refunds | payments provider driver | Driver says refunds require a separate workflow; no complete refund path proven. | Implement authenticated refund/reconciliation or controlled documented manual-only process. | Sandbox refund/partial refund/order-inventory tests. OPEN |
| OPS-15 | P1 recovery | Supabase backups and recovery | Backup/PITR/retention not verified; no restore drill or RPO/RTO. | Confirm plan and backups, approve objectives, restore isolated copy and time it. | Evidence and signed drill record. OPEN |
| PERF-16 | P2 performance | Supabase FK indexes | Advisor reports 17 unindexed FKs (catalog query found 13; reconcile). | Match advisors to indexes, workload and query plans; add justified indexes only. | Explain plans and advisor recheck. OPEN |
| OBS-17 | P2 observability | server, Render, Supabase | Render metrics empty; alerts, request IDs, centralized error/security/payment metrics not evidenced. | Define SLOs, dashboards, sanitized structured logs, alerts and incident owners. | Simulated outage/payment alert drill. OPEN |
| QA-18 | P2 test coverage | Vitest/Playwright/DB tests | No verified role matrix, RLS tests, webhook retry/replay, concurrency, refund or restore tests. | Add disposable DB role-boundary and commerce tests. | CI gates critical paths; no production data. OPEN |
| DOC-19 | P2 handoff | README and operations docs | README is one sentence; production host/ownership/recovery undocumented. | Maintain architecture/env/deploy/support docs without secret values. | New operator completes staging deploy and recovery drill. OPEN |

## Phased order and exit gates

1. **Phase A — DB containment:** DB-01, DB-02, DB-03, ORD-04/05, INV-06. Apply only reviewed migrations; no reset or destructive repair. Exit when role/RPC tests prove unauthorized calls fail and checkout/payment state transitions remain safe.
2. **Phase B — align and protect:** DB-07, APP-08, API-09, PAY-13/14. Exit when production/staging schema and payment boundary match the approved design and security regression suite passes.
3. **Phase C — delivery integrity:** RUN-10, CI-11, DEP-12. Exit when clean install/build/start, all tests and audit pass; both staging services ready on known SHA.
4. **Phase D — operational evidence:** OPS-15, PERF-16, OBS-17, QA-18, DOC-19. Exit with restore, rollback, alert and new-operator drills documented.
5. **Go/no-go:** independent reviewer confirms no open P0/P1 and scores/evidence updated. This plan does not authorize production deployment.

For each code finding preserve the chain: symptom → root cause → fix → regression test → verification. Do not delete or weaken tests to make CI green.

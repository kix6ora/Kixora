# Kixora Final Production Readiness Report

**Assessment date:** 2026-10-03  
**Decision:** **NOT PRODUCTION READY**  
**Overall score:** **15/100**, evidence-based readiness judgment, not code-quality grade.  
**Scope:** main 7768759101f95ad4f1124d53a518a32c687e5e60, PR/staging head e142e1a98f7ca7cd3501393310cabc9f77e33a15, confirmed production Supabase, staging Supabase, connected Render workspace and latest observed GitHub CI. Only documentation was added to production-hardening.

## System status

Do not release real-money checkout. P0 database mutation authorization findings remain; CI fails; observed staging deploys are down. No code, database, deployment or secret changes were made.

## Scores

Scores measure readiness evidence. Missing evidence scores low rather than being assumed successful.

| Domain | Score | Basis |
|---|---:|---|
| Architecture | 45 | Modern React/Express/Supabase structure; production topology incomplete |
| Security | 10 | Public definer RPCs, mutable paths, XSS risk, prod RLS drift |
| Authentication | 35 | Supabase Auth present; lifecycle/session flows unverified |
| Authorization | 5 | Critical DB mutations callable by anon/authenticated |
| Database | 15 | 27 tables/36 FKs; migration drift, RLS defect, RPC grants |
| Payments | 20 | PayFast server postback exists; direct RPC bypass and refunds incomplete |
| Inventory | 15 | Atomic functions exist, but exposed mutations and CI regressions |
| Ecommerce | 25 | Features exist; lifecycle not end-to-end verified |
| QA | 45 | 154 browser passes, 10 failures, 1 skip; missing critical matrices |
| Performance | 35 | 17 FK index advisories; no usable Render metrics/load measurements |
| Accessibility | 30 | axe tooling present; no verified pass report |
| SEO | 35 | Crawler path exists but injection risk; broader coverage unverified |
| Observability | 25 | Structured logs/health routes; metrics/alerts/correlation unverified |
| CI/CD | 25 | Valuable gates exist but CI red; build skipped after E2E failure |
| Deployment | 10 | Latest staging deploys failed; no prod service visible in connected workspace |
| Disaster Recovery | 5 | Backup/restore evidence unavailable; no measured drill |

## Production blockers

### P0
- **PAY-DB-01:** confirm_inventory_sale is SECURITY DEFINER, executable by anon/authenticated in both databases, can mark an arbitrary order paid and decrement inventory using supplied payment reference without internal verified-payment guard.
- **ORD-DB-02:** cleanup_stale_pending_orders is publicly executable definer accepting caller TTL that can cancel pending orders.

### P1
- **SEC-03:** Excess public execute on definer RPCs and mutable search paths (17 anon-callable in each DB).
- **DB-04:** Production migration history ends at 0027; payment_reconciliation_logs has RLS disabled.
- **ORD-05:** Guest lookup accepts email plus short numeric order code.
- **ORD-06:** Anonymous order RPCs fall back to client-supplied p_user_id.
- **INV-07:** Public reservation release; staging function lacks production paid-order guard.
- **XSS-08:** Crawler route embeds product ID into inline JS; CSP allows inline/eval.
- **DEP-09:** Five high dependency audit findings.
- **CI-10:** Playwright failing; build skipped in failing run.
- **RUN-11:** Both observed staging Render services latest deploy update_failed due missing VITE_PUBLIC_SITE_URL; no health path.

See PRODUCTION_REMEDIATION_PLAN.md for cause, fix and verification for every finding.

## Test/deploy evidence

Remote checks inspected, not executed by this audit:
- Latest PR #22 Playwright: **154 passed, 10 failed, 1 skipped**.
- Typecheck, lint, unit/component step passed; exact unit count not captured.
- Production build skipped after browser failures.
- npm audit --audit-level=high failed with **5 high severity** findings.
- Latest main CI also failed.
- Both observed Render staging services latest status update_failed; build completed, startup lacked VITE_PUBLIC_SITE_URL.
- Render metrics returned empty; no external endpoint health independently verified.
- No local tests or production transaction tests were run.

## Remaining risks and unknowns

PayFast sandbox/live configuration, refund and reconciliation; adversarial RLS role matrix; inventory concurrency; Auth recovery/expiry and admin MFA; shipping authorization/cost controls; production host/domain; Supabase backup/PITR and restore; RPO/RTO; performance/load budgets; accessibility/SEO; central monitoring/alerting remain unverified.

Scores reflect evidence and open blockers. Reassess after verified remediation.

## Recommendation

Keep production configuration unchanged. Do not merge/deploy staging branch or enable live payments. Close P0/P1 database, XSS, deploy, CI and dependency findings; pass role/payment/order/inventory tests; reconcile production migrations; demonstrate staging health and rollback; prove restore/monitoring drills. Then request a separate go/no-go review.

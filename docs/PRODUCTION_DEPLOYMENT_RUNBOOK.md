# Kixora Production Deployment Runbook

**Status:** Draft and not validated for production use. Audit found only two staging Render services and their latest deploys failed. The connected workspace did not return a production service. This is not authorization to deploy.

## Verified topology

- Repository: kix6ora/Kixora, main branch.
- Runtime: Node 22, Express 5 serving Vite-built React assets. npm run build runs TypeScript, Vite and esbuild server bundle; npm start runs dist/server.cjs.
- Data/auth: Supabase Postgres/Auth.
- Observed Render: storefront and admin staging services on staging/payfast-checkout, Frankfurt, free plan, one instance. Both latest deploys failed startup due missing VITE_PUBLIC_SITE_URL. No health-check path.
- Production host, service IDs, domains/DNS, health path and env values must be verified by the system owner first.

## Hard release gates

Do not merge or deploy while any P0/P1 audit finding is open, required GitHub checks are red, or production migrations are unreconciled. Require:

- DB function ACL/payment integrity fixes and anon/customer denial tests.
- Reviewed forward migration staged and verified; no production reset.
- Green clean install, DB gate, typecheck, lint, unit, Playwright, build and dependency audit.
- PayFast sandbox signature, postback, amount/currency/order, duplicate/replay, fail/cancel checks.
- Healthy staging readiness and proven app rollback.
- Restore evidence, approved RPO/RTO, alerting and incident ownership.

## Pre-deploy

1. Record release SHA, operator, reviewer, change reference, approver and monitoring window.
2. Verify branch protection/check results; review migration SQL and app diff.
3. Confirm the exact target is production, not the currently observed staging services.
4. Compare prod/staging migration ledgers, schema, grants, RLS, function ACL/search_path.
5. Configure approved provider secrets; never paste or log their values. Keep secrets out of VITE_ variables/browser bundles.
6. Verify a recent restorable backup and compatible app/database rollback strategy.
7. Confirm health checks, monitors, alert routes and incident contacts.

## Deployment sequence (only after target values and gates are verified)

1. Merge reviewed approved SHA using repository branch protections.
2. Apply reviewed forward-only Supabase migrations via the established workflow; record migration version and ACL/RLS checks. Never reset production.
3. Deploy exact SHA to verified production service; record Render deploy ID and commit.
4. Verify build, readiness, health, database connection and runtime logs. Do not reveal env values.
5. Run safe smoke checks: public catalog, test-user auth, checkout initialization in sandbox, direct unauthorized API denials, sandbox webhook fixture. Do not charge a real card.
6. Confirm error rate, logs/metrics, schema version and expected commerce state; monitor for agreed period and record outcome.

## Rollback

- Application: use Render’s prior known-good deployment only after confirming database compatibility and recording both deploy IDs.
- Database: prefer additive forward-compatible migrations. Never delete migration history or reset production. For suspected corruption, restore to isolation first and engage database owner.
- Trigger thresholds, authorized rollback operator, recovery time and customer communication are not yet approved or tested.
- After rollback, verify health/readiness, payment/order reconciliation, webhook claims, inventory reservations, logs and alerts.

## Environment inventory

Names are from src/config/env.ts and staging logs; this is not proof they are currently configured.

- Public/build-facing: VITE_PAYMENT_PROVIDER_MODE, VITE_PAYFAST_MERCHANT_ID, VITE_PAYFAST_MERCHANT_KEY, VITE_PAYFAST_SANDBOX, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_CUSTOMER_DOMAIN, VITE_ADMIN_DOMAIN, VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET, VITE_PUBLIC_SITE_URL, Google client ID and other optional public settings.
- Server-only: PAYFAST_PASSPHRASE, PAYFAST_MERCHANT_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, THE_COURIER_GUY_API_KEY, SHIPPING_WEBHOOK_SECRET.
- Server config: CORS_ALLOWED_ORIGINS, ADMIN_ORIGIN, CUSTOMER_ORIGIN, EMAIL_FROM, ENABLE_SHIPPING, NODE_ENV, PORT.
- Reconcile client/server duplicate names and enumerate any omitted variables from source/tests. VITE_ means browser-exposed.

This runbook is incomplete until production target, domain, env ownership, backup evidence, health path, rollback owner, monitoring and recovery objectives are verified. No deployment was performed during the audit.

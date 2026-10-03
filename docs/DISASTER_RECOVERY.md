# Kixora Disaster Recovery

**Status:** Framework only; not validated by restore drill. Production Supabase project is My Project (gyebplbyzxzdpupuixdt), confirmed by owner. Backup schedule/retention/PITR, restore permissions, RPO/RTO and production host were not verifiable using connected read-only audit tools. Recovery is unknown until evidenced.

## Objectives and ownership

Before launch, business owner must approve RPO, RTO, incident commander, database/app/payment operators, customer communications owner and out-of-band escalation contacts. Do not invent targets. Payment/order recovery must reconcile PayFast records and shipment events, not only restore a database snapshot.

## Backup evidence to collect

1. In production Supabase dashboard, record plan, backup/PITR features, frequency, retention, encryption/access controls and whether storage objects are covered.
2. Record most recent successful backup and available restore-point range without secrets.
3. Confirm least-privilege named operators and MFA.
4. Determine Cloudinary and other external-data backup/retention separately.
5. Store evidence in the approved internal operations system, not this public-source documentation branch.

Audit result: not confirmed. Do not assume platform defaults meet business targets.

## Isolated restore drill

1. Declare drill and select restore point and isolated Supabase project. Never overwrite production for a drill.
2. Restore through provider-supported workflow for the project plan. Restrict access and disable external payment/shipping/email side effects.
3. Verify migration/catalog state, table counts, constraints, RLS policies, function ACL/search_path.
4. Verify representative synthetic order/payment/inventory consistency.
5. Start a compatible app SHA in isolation and check health/readiness.
6. Record restore time, selected point, observed data loss, measured RPO/RTO, defects and operator sign-off.
7. Securely handle the restored environment under policy; do not export PII into tickets or this repository.

## Incident playbooks

### Credential compromise
Notify incident commander and credential owner through approved channel. Identify credential scope without pasting the value into logs/chat. Under incident authority revoke/rotate with provider, update dependent services, then test integration in sandbox. Review Git history, bundles, build/server logs and DB audit records; preserve evidence. Rotation was not performed during audit.

### Payment integrity incident
Pause affected checkout only under approved operator decision. Preserve PayFast, webhook and server evidence. Reconcile each order to authoritative provider transaction, amount/currency, order mapping and event history. Prevent unsupported RPC/client state changes. Correct records with reviewed auditable operations, notify affected customers through approved process, and verify ACL fixes/replay tests before reopening.

### Data corruption or unauthorized order/inventory changes
Constrain writes only under incident commander authority. Preserve DB evidence and migration ledger. Restore a copy to isolation; quantify impacted orders, payment and shipment states. Database owner chooses point-in-time restore versus audited forward correction. Reconcile paid orders, reservations, stock and shipment before reopening.

### Application outage
Check Render deploy state, startup/readiness logs, release SHA, environment-variable presence (never values) and Supabase health. Roll back only to a known compatible deploy under approved process. Verify health, admin/customer API, webhook acceptance, error rates and alerting.

### Migration failure
Stop later migrations/deployments and preserve error/version/catalog state. Determine transaction rollback versus partial apply. Do not delete migration records or reset production. Prefer reviewed forward repair; validate schema, ACL/RLS and compatibility in staging before retry.

## Recovery verification

Confirm Supabase health and intended migration version; function ACL/RLS checks pass; app SHA and readiness are correct; PayFast/order reconciliation is complete; inventory reconciles; shipping/email side effects are controlled; monitoring and customer support are active; incident commander signs against approved RPO/RTO.

## Current gaps

- Backup/PITR configuration and retention: unverified.
- Restore drill and measured RPO/RTO: not completed.
- Production hosting target and app rollback: not verified.
- Incident contacts/customer communications: not supplied.
- Payment/RPC vulnerabilities are present; this plan alone does not mitigate them.

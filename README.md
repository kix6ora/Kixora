# Kixora

Kixora is a premium sneaker e-commerce web application with a customer storefront and administrator dashboard.

## Production readiness

The current audited baseline is **NOT PRODUCTION READY**. Do not use live payment processing until the P0/P1 blockers in the audit are remediated and independently verified.

- [Production readiness audit](docs/PRODUCTION_READINESS_AUDIT.md)
- [Remediation plan](docs/PRODUCTION_REMEDIATION_PLAN.md)
- [Deployment runbook](docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md) (draft; not validated)
- [Disaster recovery](docs/DISASTER_RECOVERY.md) (restore not yet proven)
- [Final readiness report](docs/FINAL_PRODUCTION_READINESS_REPORT.md)

The audit reflects evidence collected 2026-10-03 from GitHub, the confirmed production and staging Supabase projects, the connected Render workspace and GitHub Actions. It made documentation changes only; it did not change application code, production data, deployment configuration or secrets.

## Local development

The repository uses Node 22 and npm. See package.json for the available development, build, test and release-gate scripts. Do not treat passing local checks as a substitute for the required database role, payment, deployment and recovery verification described in the audit.

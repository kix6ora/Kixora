# Kixora

Kixora is a premium sneaker e-commerce web application with a customer storefront and administrator dashboard.

## Production readiness

The current assessment is **NOT PRODUCTION READY**. Do not enable real-money checkout while P0/P1 findings remain open.

- [Current architecture](docs/CURRENT_ARCHITECTURE.md)
- [Baseline status](docs/BASELINE_STATUS.md)
- [Completion workflow](docs/KIXORA_COMPLETION_WORKFLOW.md)
- [Production readiness audit](docs/PRODUCTION_READINESS_AUDIT.md)
- [Remediation plan](docs/PRODUCTION_REMEDIATION_PLAN.md)
- [Deployment runbook](docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md) (draft, not validated)
- [Disaster recovery](docs/DISASTER_RECOVERY.md) (restore not yet proven)
- [Final readiness report](docs/FINAL_PRODUCTION_READINESS_REPORT.md)

The production-hardening branch includes an initial RPC authorization/service-role fix and regression checks. The migration has not been applied to a live database or deployed, so the P0 findings remain open until isolated PostgreSQL role tests pass. No production data or secrets were changed.

## Local development

CI uses Node 22 and npm. See package.json for development, build, test and release-gate scripts. A passing local build is not a substitute for database role, payment, deployment and recovery verification.


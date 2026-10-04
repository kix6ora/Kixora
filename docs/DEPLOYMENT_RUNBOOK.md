# Kixora Deployment Runbook

## Secret management

1. Store all runtime secrets in GitHub Environment secrets or a dedicated secret manager such as Google Secret Manager, AWS Secrets Manager, or HashiCorp Vault.
2. Never commit real credentials to source control.
3. Keep separate values for staging and production. Never reuse the same service role key or payment webhook secret between environments.
4. Confirm every deployment uses explicit environment variables and that `CORS_ALLOWED_ORIGINS` contains only HTTPS origins without wildcards or path suffixes.

## Required runtime secrets

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAYFAST_PASSPHRASE`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `THE_COURIER_GUY_API_KEY`
- `SHIPLOGIC_API_KEY`
- `SHIPPING_WEBHOOK_SECRET`
- `SENTRY_DSN`
- `GCP_SERVICE_ACCOUNT_KEY` (deployment only)

## Deploy flow

### Staging

1. Push to the `develop` branch or trigger the workflow manually.
2. The workflow validates deployment requirements and then builds and deploys the container image to Cloud Run.
3. Smoke-test `/api/health` before treating staging as green.
4. Run the staging smoke suite and confirm the app is reachable from the intended public domain.

### Production

1. Require a proper production environment approval in GitHub Actions.
2. Trigger the production deployment workflow manually only after staging is green.
3. Validate `/api/health` immediately after deployment and verify the expected environment metadata.
4. Monitor logs and error events for the first 30–60 minutes before considering the deployment fully stable.

## Rollback

1. Re-run the deployment workflow with the prior known-good image tag.
2. If the issue is in the application configuration, revert the latest environment values and redeploy.
3. Confirm the previous version is healthy by hitting `/api/health` and the storefront home page.
4. Capture the incident in the release record and keep the failing image tag for later debugging.

## Monitoring and alerting

- Use Sentry for application error tracking via `SENTRY_DSN`.
- Send structured logs via `logger` and keep `/api/health` and `/api/ready` monitored at least every 60 seconds.
- Alert on sustained 5xx responses, failed webhook verification, and database degradation.

## Production gate

Do not proceed with production release if any of the following are true:

- `CORS_ALLOWED_ORIGINS` is empty or contains `*`
- production secrets are missing from the environment
- `/api/health` fails or returns degraded
- webhook verification fails in staging or production
- payment provider mode is not explicitly configured for the target environment

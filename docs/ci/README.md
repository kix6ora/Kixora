# CI / Deploy workflow — manual install required

`deploy-render.workflow.yml` in this directory is the Render deploy pipeline that
replaces the deleted Cloud Run workflows (`deploy-staging.yml`,
`deploy-production.yml`).

It lives here rather than in `.github/workflows/` because the automated agent
that prepared this branch does not hold GitHub's `workflows` permission, so it
cannot create or modify files under `.github/workflows/`.

## Install it (one command)

```bash
mkdir -p .github/workflows
cp docs/ci/deploy-render.workflow.yml .github/workflows/deploy-render.yml
git add .github/workflows/deploy-render.yml
git rm .github/workflows/deploy-staging.yml .github/workflows/deploy-production.yml
git commit -m "ci: replace Cloud Run workflows with Render deploy pipeline"
git push
```

On Windows PowerShell, run one command per line (never `&&`):

```powershell
New-Item -ItemType Directory -Force -Path .github/workflows
Copy-Item docs/ci/deploy-render.workflow.yml .github/workflows/deploy-render.yml
git add .github/workflows/deploy-render.yml
git rm .github/workflows/deploy-staging.yml .github/workflows/deploy-production.yml
git commit -m "ci: replace Cloud Run workflows with Render deploy pipeline"
git push
```

## Required secrets and variables

Secrets:

- `RENDER_STAGING_DEPLOY_HOOK` — Render Deploy Hook URL for `kixora-staging`
- `RENDER_PRODUCTION_DEPLOY_HOOK` — Render Deploy Hook URL for `kixora-web`
- `STAGING_HEALTH_URL` — e.g. `https://kixora-staging.onrender.com`
- `PRODUCTION_HEALTH_URL` — e.g. `https://kixora.com`

Variables (per GitHub Environment `staging` / `production`):

- `STAGING_CUSTOMER_ORIGIN`, `STAGING_ADMIN_ORIGIN`, `STAGING_CORS_ALLOWED_ORIGINS`
- `PRODUCTION_CUSTOMER_ORIGIN`, `PRODUCTION_ADMIN_ORIGIN`, `PRODUCTION_CORS_ALLOWED_ORIGINS`

Delete these GitHub secrets — they belong to the removed GCP pipeline:

- `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT_KEY`, `CLOUD_RUN_REGION`,
  `CLOUD_RUN_SERVICE_STAGING`, `CLOUD_RUN_SERVICE_PRODUCTION`,
  `ARTIFACT_REGISTRY_REPOSITORY`

## Verify before committing

```bash
node -e "const Y=require('yaml'),f=require('fs');const d=Y.parse(f.readFileSync('docs/ci/deploy-render.workflow.yml','utf8'));console.log('jobs:',Object.keys(d.jobs))"
```

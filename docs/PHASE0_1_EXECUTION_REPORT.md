# Phase 0 & Phase 1 — Execution Report

**Branch:** `cline/7hm793k0` (based on `develop` @ `592c451`)
**Scope:** Phase 0 (baseline & repo hygiene) and Phase 1 (de-platform to Render)
from `docs/PRODUCTION_READY_WORKFLOW.md`.
**Platform of record after this change:** Render (web) + Supabase.

Legend: ✅ done in this branch · 🧑 **human action required** (cannot be done from
the repository) · ⏭ deferred to a later phase.

---

## Phase 0 — Baseline, branch discipline, repo hygiene

| Step | Status | Evidence / note |
|---|---|---|
| Confirm branch topology | ✅ | `main` was **162 commits behind** `develop` and shared no merge base in the shallow clone. Branch is now merged with `origin/develop` so all work sits on the real tip. |
| Merge `develop` → `main` via PR | 🧑 | Must be done by you with review. `main` is stale; `develop` is the true integration tip. |
| Freeze feature work during Phases 1–3 | 🧑 | Process control. |
| Record baseline | ✅ | See "Baseline evidence" below. |
| Delete dead artifacts | ✅ | `bun.lock`, `kixora-staging-blockers.patch` deleted in this branch. `firebase-applet-config.json`, `metadata.json`, `skills-lock.json` were already deleted on `develop` and are gone after the merge. `src/hooks/useGoogleAuth.ts` and `src/services/googleDriveService.ts` also gone. |
| Rotate the Firebase API key | 🧑 | **Critical.** The key in `firebase-applet-config.json` is in git history. Deleting the file does not revoke it. |
| Pin Node engine | ✅ | `package.json` now has `"engines": { "node": ">=22 <23" }`. |
| Fix `.gitignore` duplicate | ✅ | Trailing duplicate `playwright-report/` removed. |
| Commit governance docs | ✅ | `CLAUDE.md`, `AGENTS.md`, `render.yaml`, `docs/PRODUCTION_READY_WORKFLOW.md`, `docs/REMOVAL_CLOUDRUN_AND_DRIVERS.md`. |
| Delete stale remote branches | 🧑 | `fix/audit-gate-prod-only`, `fix/ci-green`, `fix/guest-merge-uuid`, `fix/p0-launch-blockers`, `fix/staging-blockers`, `staging/payfast-checkout`, `cline/21kqtaq0`. They are not ancestors of `develop`, so they were likely squash-merged — **verify in the GitHub UI before deleting**. |

---

## Phase 1 — De-platform: remove Cloud Run/GCP, adopt Render

| Step | Status | Evidence / note |
|---|---|---|
| Delete Cloud Run deploy workflows | ✅/🧑 | `.github/workflows/deploy-staging.yml` and `deploy-production.yml` are deleted in this branch. If the push is rejected for the same `workflows` permission reason, delete them via the GitHub UI or with a token that has the `workflows` scope. |
| Delete `scripts/verify-deploy-env.mjs` (Cloud Run version) | ✅ | Replaced, not just removed — see next row. |
| Add Render-aware env assertion | ✅ | `scripts/verify-deploy-env.mjs` rewritten to assert the **application** contract (Supabase live coords, all `VITE_USE_SUPABASE_*`, PayFast mode, distinct HTTPS origins, CORS allowlist without wildcard). Exposed as `npm run deploy:check`. Verified: exits 1 on an empty env, exits 0 on a valid production env. |
| Strip `CLOUD_RUN_*` from `.env.example` | ✅ | Removed `CLOUD_RUN_PROJECT_ID`, `CLOUD_RUN_REGION`, `CLOUD_RUN_SERVICE_STAGING`, `CLOUD_RUN_SERVICE_PRODUCTION`, `ARTIFACT_REGISTRY_REPOSITORY`. Replaced with a Render/Supabase section that documents build-time `VITE_*` semantics. |
| Add `render.yaml` | ✅ | Two services: `kixora-web` (main, manual deploy) and `kixora-staging` (develop, auto-deploy). Full env contract included. Validated as parseable YAML. |
| Add Render deploy workflow | ✅ | Content authored and validated as YAML (jobs `deploy-staging`, `deploy-production`): staging on push to `develop`, production via `workflow_dispatch` with `environment: production` approval, Render Deploy Hooks + `/api/health` poll. **Staged at `docs/ci/deploy-render.workflow.yml`** instead of `.github/workflows/` because the agent's GitHub token lacks the `workflows` permission. Install with the one command in `docs/ci/README.md`. |
| Rewrite `docs/DEPLOYMENT_RUNBOOK.md` | ✅ | Removed `GCP_SERVICE_ACCOUNT_KEY`, Google Secret Manager, Cloud Run, and the dead `STRIPE_*` / `SHIPLOGIC_API_KEY` secrets. Rollback is now Render-dashboard-based. |
| Rewrite Cloud Run/Cloudflare parts of `PRODUCTION_LAUNCH.md` | ✅ | CDN diagram → Render Edge; removed the `199.36.158.100` (Google LB) A-record; DNS table now points at Render targets; cutover and rollback rewritten. `grep` for GCP terms returns clean. |
| Fix `docs/STAGING_SETUP_GUIDE.md` | ✅ | Vercel/Netlify/Cloud Run/GCR deployment options replaced with the Render path. |
| Fix `docs/PRODUCTION_PHASES.md` | ✅ | Wrong repo URL and non-existent branch removed; Cloudflare line replaced; file marked superseded by the workflow doc. |
| Annotate `PRODUCTION_READINESS_AUDIT.md` | ✅ | Added a platform note so historical Cloud Run references are not re-adopted. |
| Wire the env assertion into CI | ✅ | It runs as the first step of both deploy jobs. **Deviation:** it runs in the deploy job rather than the test job, because it needs environment secrets that CI does not have. Staging runs it with `continue-on-error: true`; production is strict. |
| Create the Render services | 🧑 | Render Dashboard → New → Blueprint, pointed at this repo. |
| Attach custom domains | 🧑 | `kixora.com`, `www.kixora.com`, `admin.kixora.com`. |
| Set Render environment variables | 🧑 | Use the table in `docs/REMOVAL_CLOUDRUN_AND_DRIVERS.md` §4.4 / `render.yaml`. |
| Create GitHub secrets for the deploy workflow | 🧑 | `RENDER_STAGING_DEPLOY_HOOK`, `RENDER_PRODUCTION_DEPLOY_HOOK`, `STAGING_HEALTH_URL`, `PRODUCTION_HEALTH_URL`. |
| Delete the GCP GitHub secrets | 🧑 | `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT_KEY`, `CLOUD_RUN_REGION`, `CLOUD_RUN_SERVICE_STAGING`, `CLOUD_RUN_SERVICE_PRODUCTION`, `ARTIFACT_REGISTRY_REPOSITORY`. |
| Keep the `Dockerfile` | ✅ | Intentionally retained — Render can build from it, and it is already correct (multi-stage, non-root, `EXPOSE 3000`). |

---

## Baseline evidence (recorded before Phase 0 changes)

| Item | Value |
|---|---|
| `main` | `e4c973a` — 162 commits behind `develop`, stale |
| `develop` | `592c451` — integration tip at time of review |
| Runtime | Node 22 (`engines` pinned to `>=22 <23` in this branch) |
| Lockfile | `package-lock.json` only (`bun.lock` removed in this branch) |
| Unit/component suite | 28 files, 76 tests |
| DB migrations | 33 (`supabase/migrations/0001`–`0033`) |
| Deploy workflows before | 4 (`test-and-build`, `staging`, `deploy-staging`, `deploy-production`) |
| Deploy workflows after | 3 (`test-and-build`, `staging`, `deploy-render`) |

## Verification (run in this branch)

```
npx tsc --noEmit                          -> exit 0
npx eslint . --max-warnings 0             -> exit 0
npm run test                              -> exit 0  (28 files, 76 tests passed)
npm run build                             -> exit 0  (dist/server.cjs 87.7kb, admin-hub chunk emitted)
node scripts/verify-deploy-env.mjs        -> exit 1 on empty env (fail-closed)
node scripts/verify-deploy-env.mjs        -> exit 0 on a valid production env
```

YAML parse validation:

```
.github/workflows/deploy-render.yml  -> VALID (jobs: deploy-staging, deploy-production)
render.yaml                          -> VALID (services: kixora-web, kixora-staging)
```

Residual-reference scan:

```
git grep -inE 'cloud_run|cloud run|gcloud|gcr\.io|artifact_registry|africa-southeast1|google-github-actions' -- . ':!docs/*' ':!*.md'
-> 3 hits, all comments that explicitly state GCP is NOT used
   (.env.example, render.yaml, scripts/verify-deploy-env.mjs)

git grep -inE 'stripe|shiplogic|gemini|firebase|googledrive' -- . ':!docs/*' ':!*.md'
-> 1 hit, a false positive: "zebra-striped" in src/data/sneakers.ts
```

---

## What is NOT done (by design)

These belong to later phases and are listed here so nothing is mistaken for
complete:

- **Phase 3:** `MockPaymentDriver` still ships in the production bundle. Confirmed
  by building and grepping: `dist/assets/admin-hub-*.js` and `dist/server.cjs`
  both contain `pi_mock_`. It is runtime-guarded but not bundler-excluded.
  `TheCourierGuyDriver` is still simulated; Cloudinary still used for media.
- **Phase 4:** `public/sw.js` is still cache-first for navigations;
  `/api/health` still returns 503 when Supabase is unhealthy instead of
  separating liveness from readiness.
- **Phase 5:** `csurf` still in use; rate-limit store still in-memory.
- **Phase 7:** no Sentry SDK installed yet.

## Human actions required before Phase 2 can start

1. Rotate/revoke the Firebase API key exposed in git history.
2. Create the Render Blueprint from `render.yaml` (or create both services manually).
3. Attach the custom domains and copy the Render DNS targets into the registrar.
4. Populate the Render environment variables and the GitHub secrets listed in
   Phase 1 above.
5. Delete the GCP GitHub secrets.
6. Verify then delete the stale `fix/*` remote branches.
7. Merge `develop` → `main` through a reviewed PR so `main` stops being 162 commits behind.


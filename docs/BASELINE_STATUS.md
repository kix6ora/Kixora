# Kixora Baseline Status

**Captured:** 2026-10-04 (local source checkout at e71e3e4b2d924d6d20f5280ddaf2d6295b733c9f, ancestor of audited main 7768759101f95ad4f1124d53a518a32c687e5e60). The source checkout differs from the audit branch by repository history/docs, not application source according to the GitHub compare result.

## Environment and commands

- Local runtime was Node **v26.9.0** on Windows; CI config selects Node 22.x. Local results are not a substitute for the intended Node 22 run.
- `npm ci`: **passed**, 560 packages installed; reported **5 high-severity vulnerabilities**. npm noted install scripts for esbuild packages were not approved in this environment, but the subsequent build succeeded.
- `npm run build`: **passed**. Includes TypeScript compilation, Vite build and esbuild server bundle.
- `npm run lint`: **passed**. Includes strict ESLint and `tsc --noEmit`; there is no separate typecheck npm script.
- `npm test`: initial default Vite config loading failed because esbuild could not access an ancestor directory under the sandbox. Equivalent suite using `npx vitest run --config vitest.config.ts --configLoader runner`: **passed, 6 files / 17 tests** after current RPC work.
- `npm run test:e2e -- --reporter=line`: **blocked before tests started**; the Playwright web-server process exited in Node 26.9 with `uv_os_get_passwd returned ENOMEM`. The configured CI Node 22 runtime is not installed locally.
- `npm run db:gate`: wrapper reported **SKIPPED** because local Supabase/Docker was unavailable; CLI telemetry could not write under the user profile due sandbox permissions. This is not a migration pass.
- `npm audit --audit-level=high`: registry audit endpoint unavailable from the local network; npm ci and the latest remote CI both reported five high findings.
- `node .../tsx ... supabase/tests/validate_database.ts` with a temporary test-only workaround for the sandbox Node user-info failure: **passed** static migration statement checks for 32 migration files and in-memory schema/integrity scenarios (including 15 core tests in the script). It is not a real PostgreSQL migration application. The validator now explicitly checks GRANT/REVOKE and ALTER FUNCTION search-path statement forms because its SQL AST parser does not support those productions.

## Remote CI baseline

Latest observed PR #22 run (remote; no local rerun): typecheck, lint and unit/component stage passed; Playwright **154 passed, 10 failed, 1 skipped**; production build skipped after E2E failure; `npm audit --audit-level=high` failed on **5 high** dependency findings. Latest observed main run also failed. See `docs/PRODUCTION_READINESS_AUDIT.md` for failure groups and live-service evidence.

## Current code change verification

The first RPC hardening slice is included in the production-hardening branch. Current evidence: strict lint/typecheck passed; Vitest passed at 18 tests; production build passed; in-memory migration validation passed. No live migration, Supabase role test, production transaction, or deployment was performed. The P0 work remains OPEN until an isolated real PostgreSQL/Supabase role test proves the grants and behavior.

## Baseline decision

**NOT PRODUCTION READY.** Reasons: exposed payment/order RPCs, production database drift, staging deployments failing, remote CI red, high dependency findings, no verified restore drill, and incomplete end-to-end role/payment/inventory evidence. Do not use this baseline as production approval.


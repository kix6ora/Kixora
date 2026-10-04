# Production Evidence Tracker
| Phase | Status | Evidence files | Verified by | Date |
|-------|--------|----------------|-------------|------|
| 0     | PARTIAL - 23/23 existing tests green; "26 tests" target unattainable (audit count not reproducible) | docs/production-evidence/phase0-baseline-commit.txt, phase0-run.log, phase0-integrations-test.log, phase0-rls-test.log, phase0-rls-rerun.log, phase0-rerun.log, phase0-run.ps1, phase0-rerun.ps1 | Cline (agent) on Windows 11 / Node + Playwright local run | 2026-10-04 |

## Phase 0 notes (baseline and agent workspace)

Pinned baseline commit: `7768759101f95ad4f1124d53a518a32c687e5e60` (fresh-clone HEAD = `main`,
matches `PRODUCTION_REMEDIATION_PLAN.md`: "audit of main 7768759101f95ad4f1124d53a518a32c687e5e60").
Work branch: `production-readiness/audit-execution` (created from `main`).

### Reproduced evidence on the pinned commit

| Step | Command | Result |
|------|---------|--------|
| Install | `npm ci` | rc=0 |
| Browsers | `npx playwright install --with-deps` | rc=0 |
| Integrations | `npx playwright test tests/integrations --reporter=line` | **17 passed** (rc=0) - audit doc expects 20 |
| RLS | `npx playwright test tests/security/phase8-rls-penetration.spec.ts --reporter=line` | cold run 5 passed / 1 failed (RLS-05 `page.goto` 60s timeout); warm re-run **6 passed** (rc=0) |
| Lint | `npm run lint` | rc=0 |
| Build | `npm run build` | rc=0 |

### Discrepancy 1 - integration test count (20 expected vs 17 actual)

- `tests/integrations` on the pinned commit contains 5 spec files:
  `email-pipeline.spec.ts`, `phase3-provider-validation.spec.ts`, `shipping-carrier.spec.ts`,
  `tracking-webhook.spec.ts`, `webhook-security-hardening.spec.ts` = 17 tests, all passing.
- `git ls-tree` shows the **identical 5 files** on `origin/production-hardening`; the
  `git diff --stat main origin/production-hardening -- tests/` adds only
  `tests/unit/envConfig.test.ts` and `tests/unit/security/rpcAuthorizationMigration.test.ts`
  (unit tests) and modifies `tests/security/phase-a-hardening.spec.ts`.
- Conclusion: **no committed branch in the repository contains 20 integration tests**, so the
  audit document's `20 passed` figure is not reproducible. The Phase 0 gate target of "26 tests"
  is therefore unattainable - the complete inventory of these two suites is **23 tests (17 + 6)**,
  all green on the pinned commit. This must be resolved (updated expectation or recovered spec
  files) before Phase 1 evidence is built on this baseline.

### Discrepancy 2 - RLS-05 cold-start timeout (environmental, not a regression)

- First RLS run: RLS-05 (`page.goto('/')` + `waitForSelector('header')`) exceeded the 60s test
  timeout while Vite compiled the full app graph for the first time on a OneDrive-synced
  filesystem; RLS-06 (executed immediately after) passed on the same server.
- Warm re-run of the same spec on the same commit: **6 passed (1.7m)**.
- Conclusion: cold-start compile latency, not a code defect. Recommend raising the first-load
  budget (e.g. a warm-up request/global setup) before treating this suite as a gate in CI.

### Committed evidence

- Evidence commit `de541da` (tracker, pinned-commit file, reproduction scripts) and
  logs commit `092830e` (raw run logs) on branch `production-readiness/audit-execution`,
  both pushed to `origin` (`git rev-parse origin/production-readiness/audit-execution` = `092830e`).

### Environment caveat

Local runs execute from `C:\Users\mandl\OneDrive\Desktop\Kixora` (OneDrive-synced), which makes
`npm ci` (~35 min) and the first Vite compile extremely slow. This does not affect correctness but
does inflate timing evidence; the audit's original timings (4.9s / 9.7s) are not comparable here.
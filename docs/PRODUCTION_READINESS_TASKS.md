# Kixora — Production Readiness Tasks (ground truth)

**Reviewed:** 2026-10-14 · **Branch of record:** `develop` @ `96b2033`
(`main` @ `e4c973a` is stale — 5,094 insertions / 2,635 deletions / 112 files behind).
**Companion docs:** `docs/PRODUCTION_READY_WORKFLOW.md` (plan + per-phase gates),
`CLAUDE.md` / `AGENTS.md` (standing rules), `docs/PHASE0_1_EXECUTION_REPORT.md`.

Legend: 🔴 **build-blocking** · 🟠 **launch-blocking** · 🟡 **should fix** · 🧑 human-only (not a code change).

This is the evidence-based remainder. Everything in §7 is already done — do not redo it.

---

## 1. Code blockers — highest value first

| # | Sev | Task | Where | Exit gate |
|---|---|---|---|---|
| T1 | ✅ | **DONE — Real error tracking.** `@sentry/react` + `@sentry/node` v11 added; SDK init in `src/lib/sentryBrowser.ts` / `src/lib/sentryServer.ts`, wired from `src/main.tsx` + `server.ts`, gated on `SENTRY_DSN`. The fake `fetch(DSN)` POST was removed from `monitoringService`. | `src/lib/sentry*.ts`, `src/services/monitoringService.ts`, `server.ts`, `src/main.tsx` | Code done. Remaining: set `SENTRY_DSN` on Render and verify one live event. Evidence: `docs/production-evidence/t1-t2-sentry-csp.md`. |
| T2 | ✅ | **DONE — CSP tightening.** `script-src` is now `'self'` in production (no `'unsafe-inline'`/`'unsafe-eval'`); the crawler inline `<script>` became a `<meta http-equiv="refresh">`. | `server.ts`, `src/config/cspImageSources.ts` | Verified live header `script-src 'self'`. Evidence: `docs/production-evidence/t1-t2-sentry-csp.md`. |
| T3 | ✅ | **DONE — Replace `csurf`.** Removed from deps; `src/server/csrf.ts` implements a Fetch Metadata (`Sec-Fetch-Site`) guard + double-submit cookie. ADR: `docs/adr/0001-csrf-double-submit.md`. | `src/server/csrf.ts`, `server.ts`, `package.json` | Verified live: 403 on missing/cross-site, token accepted. Evidence: `docs/production-evidence/t3-t4-csrf-ratelimit.md`. |
| T4 | ✅ | **DONE — Rate-limit store.** Policies extracted to `src/server/rateLimit.ts` (unit-tested); per-instance limits accepted and `numInstances: 1` pinned with an ADR reference in `render.yaml`. ADR: `docs/adr/0002-rate-limit-store.md`. | `src/server/rateLimit.ts`, `render.yaml` | Single-instance asserted in `render.yaml`; startup log reports the store mode. Evidence: `docs/production-evidence/t3-t4-csrf-ratelimit.md`. |
| T5 | ✅ | **DONE — Carrier deferral recorded and enforced.** The live The Courier Guy API is deferred (auth scheme + shipment/label paths unconfirmed; no credential). Production now: quotes carry `isEstimate: true` + a `logger.warn` (no longer silent), labels throw `CarrierCapabilityError`, tracking returns `errorCode`, `/api/ready` reports `carrier`, and the simulated driver is production-rejected. Status source of truth: `src/services/shipping/carrierCapabilities.ts`. | `carrierCapabilities.ts`, `shippingService.ts`, `carrierTypes.ts`, `healthCheck.ts` | Deferral signed in `docs/production-evidence/go-no-go.md`; enforced in code + unit tests. |
| T6 | 🟠 | **Mock payment driver out of the bundle.** `MockPaymentDriver` is still bundled (`pi_mock_` in `dist/`); runtime-guarded but not bundler-excluded. Convert to a conditional dynamic `import()` behind `if (!import.meta.env.PROD)`. | `src/services/payments/index.ts` | `grep -rl "pi_mock_" dist/` prints nothing. |
| T7 | 🟡 | **Retire stale docs.** `docs/PRODUCTION_PHASES.md` names the wrong repo/branch. Replace with a pointer to this file, or delete. | `docs/PRODUCTION_PHASES.md` | No doc references a non-existent repo/branch. |
| T8 | 🟡 | **Admin flags parity.** `VITE_USE_SUPABASE_ADMIN*` exist in `.env.example` but not in `render.yaml` or the `scripts/flags.ts` gate. Decide whether they are load-bearing; add them or remove them. | `.env.example`, `render.yaml`, `scripts/flags.ts` | Config contract consistent across all three. |

---

## 2. Phase 2 — Supabase as the single source of truth

| # | Sev | Task | Evidence required |
|---|---|---|---|
| T9 | 🟠 | Provision **two** Supabase projects (`kixora-staging`, `kixora-prod`), region closest to users (`af-south-1` if available). | Project refs recorded. |
| T10 | 🟠 | Apply all **37** migrations to staging (`supabase link` + `db push`), then `supabase db lint`. Verify grants on a **brand-new** project (0030/0031 baseline). | Lint output; grant check output. |
| T11 | 🟠 | Run `tests/security/phase8-rls-penetration.spec.ts` against **live** staging with real customer + admin accounts. | Customer gets `403`/`42501` on `admin_audit_logs` + admin RPC; admin gets `200`. |
| T12 | 🟠 | Confirm Realtime is enabled for subscribed tables and RLS scopes rows to the owner. | Subscription receives only own rows. |
| T13 | 🟠 | Turn on every core `VITE_USE_SUPABASE_*` flag in both environments (already `true` in `render.yaml`; confirm live). | `scripts/flags.ts` passes a real build. |
| T14 | 🟡 | Migrate media to Supabase Storage (buckets from `0024_storage_setup.sql`) and retire Cloudinary, **or** pin the Cloudinary cloud name and keep CSP origins exact. | Images load; CSP `imgSrc`/`connectSrc` match the real origin. |
| T15 | 🟠 | Set the admin role through `app_metadata` only (`0012_auth_role_sync.sql`). | Admin session resolves role; `user_metadata` unused. |

---

## 3. Phase 5 — Security verification (live)

| # | Sev | Task | Evidence required |
|---|---|---|---|
| T16 | 🟠 | Run `scripts/staging/verify-api-roles.mjs` against staging; keep the JSON. | Exits 0; JSON attached. |
| T17 | 🟠 | Secret scan of the built bundle for `SUPABASE_SERVICE_ROLE_KEY`, `PAYFAST_PASSPHRASE`, `RESEND_API_KEY`, `THE_COURIER_GUY_API_KEY`, `SHIPPING_WEBHOOK_SECRET`. | Zero matches. |
| T18 | 🟠 | Verify live headers: HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`. | Captured response headers. |
| T19 | 🟠 | Replay a bad PayFast ITN and a bad carrier webhook (`scripts/staging/payfast-itn-replay.mjs`: `wrong-signature`, `wrong-amount`, `duplicate`, `unknown-order`, `cancelled`). | All rejected, no state change. |
| T20 | 🟡 | Keep `npm audit --omit=dev --audit-level=high` as a hard CI gate; add Dependabot/Renovate. | CI fails on high/critical. |
| T21 | 🧑 | **Rotate/revoke the Firebase API key** committed in git history (`firebase-applet-config.json`). Deleting the file does not revoke it. | Key revoked in Google console. |

---

## 4. Phase 6 — Payments, fulfilment, email (end to end)

| # | Sev | Task | Evidence required |
|---|---|---|---|
| T22 | 🟠 | Full PayFast sandbox checkout: initiate → sandbox → ITN → order `paid`. | Raw ITN + order row. |
| T23 | 🟠 | Idempotency: replay the same ITN twice → exactly one transition. Wrong amount / wrong signature rejected. | Replay transcripts. |
| T24 | 🟠 | Inventory concurrency: stock = 1, two concurrent purchases → exactly one succeeds; failure leaves stock intact. | Two responses. |
| T25 | 🟠 | Email: order confirmation via Resend; verify SPF/DKIM/DMARC; lands in inbox. | Email headers. |
| T26 | 🟠 | Admin status change persists via `admin_transition_order_status` and shows in the customer timeline. | Before/after rows. |
| T27 | 🟡 | Reconciliation: paid-but-unfulfilled order surfaces in the admin dashboard (`analyticsAdminRepository`). | Query output / screenshot. |

---

## 5. Phase 8 — Launch cutover

| # | Sev | Task |
|---|---|---|
| T28 | 🟠 | Pre-flight: prod Supabase migrated + RLS-verified; prod Render env complete; `VITE_*` set **before** build; origins match real domains; `VITE_PAYFAST_SANDBOX=false` + live creds. |
| T29 | 🟠 | Dry-run the cutover on staging, including a rollback; time it. |
| T30 | 🟠 | DNS: point `kixora.com` + `admin.kixora.com` at Render (no CDN in front without instruction). |
| T31 | 🟠 | Run the smoke suite: `/api/health` 200, `/` 200, `/api/ready` reports live provider, real payment, bad ITN rejected, admin 403 for customer token, live catalog renders. |
| T32 | 🟠 | Write `docs/production-evidence/go-no-go.md`: every line has an evidence link and pass/fail. No "assumed". |
| T33 | 🟠 | Post-launch: monitor 60 min (5xx rate, webhook failures, `/api/ready`, Sentry count); keep the previous deploy warm for rollback. |

---

## 6. Human-only actions (cannot be done from the repo)

1. 🧑 Rotate/revoke the Firebase API key (T21).
2. 🧑 Create the Render Blueprint from `render.yaml` (services `kixora-web`, `kixora-staging`, `kixora-admin-staging`) and attach domains.
3. 🧑 Populate Render env vars + GitHub secrets (`RENDER_DEPLOY_HOOK_*`, `STAGING_HEALTH_URL`, `PRODUCTION_HEALTH_URL`, etc.).
4. 🧑 Delete the GCP GitHub secrets.
5. 🧑 Verify then delete the merged stale remote branches (`fix/*`, `staging/payfast-checkout`; `cline/21kqtaq0` is unmerged).
6. 🧑 Merge `develop` → `main` through a reviewed PR so `main` stops being stale.

---

## 7. Already done on `develop` — do not redo

- ✅ Phase 0 hygiene: `bun.lock`, `firebase-applet-config.json`, `metadata.json`,
  `skills-lock.json`, `kixora-staging-blockers.patch` deleted; `engines` pinned;
  `.gitignore` deduped; governance docs committed.
- ✅ Phase 1 de-platform: Cloud Run workflows deleted; `deploy-render.yml` added;
  `scripts/verify-deploy-env.mjs` rewritten to the app contract; `.env.example`
  GCP vars stripped; `render.yaml` present.
- ✅ Service worker: versioned cache (`kixora-shell-${BUILD_ID}`), network-first
  navigation, cache-first `/assets/*` only, never caches `/api/*`, `SKIP_WAITING`.
- ✅ Health/readiness split: `livenessCheck` (`/api/health`) vs `readinessCheck`
  (`/api/ready`).
- ✅ Live-data build gate: `scripts/flags.ts` + `vite.config.ts` wiring.
- ✅ Carrier honesty: `SimulatedCourierGuyDriver` + `isSimulated = true` +
  production fail-closed + flat-rate fallback (`flatRate.ts`).
- ✅ Security migrations 0034–0036 (RLS lockdown, owner-only bespoke, admin
  function `search_path` pin) and 0037 (flat-rate shipping).
- ✅ CI: `test-and-build.yml`, `staging.yml`, `deploy-render.yml`; release gate;
  npm audit gate; `REQUIRE_SUPABASE=true` migration gate.

---

## 8. Suggested order

```
T6 mock driver out of the bundle → T9–T15 Supabase live
  → T11/T16–T19 live security evidence → T22–T27 payments/fulfilment E2E
  → T28–T33 cutover + go/no-go
```

*(T1 Sentry, T2 CSP, T3 csurf, T4 rate-limit store and T5 carrier deferral are done
— evidence in `docs/production-evidence/`.)*

Human-only steps are consolidated in **`docs/HUMAN_ACTIONS.md`**.

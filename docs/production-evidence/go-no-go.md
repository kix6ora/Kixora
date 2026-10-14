# Kixora — Go / No-Go record

**Status:** NOT READY TO LAUNCH · **Updated:** 2026-10-14 · **Branch:** `develop` @ `96b2033`

Every line needs evidence or an explicit deferral. No item may be "assumed".
Sources: `docs/PRODUCTION_READINESS_TASKS.md`, `docs/HUMAN_ACTIONS.md`,
`docs/production-evidence/`.

| # | Item | State | Evidence / decision |
|---|---|---|---|
| 1 | Error tracking (Sentry) | ⏳ pending credential | SDK wired (T1). Needs `SENTRY_DSN` + one live event. |
| 2 | CSP strict in production | ✅ done | `script-src 'self'`. `docs/production-evidence/t1-t2-sentry-csp.md`. |
| 3 | CSRF | ✅ done | `csurf` removed; ADR `0001`. `docs/production-evidence/t3-t4-csrf-ratelimit.md`. |
| 4 | Rate limits | ✅ decided | Per-instance, `numInstances: 1`; ADR `0002`. |
| 5 | **Carrier (The Courier Guy)** | ⚠️ **DEFERRED — accepted** | See the deferral section below. |
| 6 | Live Supabase (staging/prod) | ⬜ not verified | Tasks T9–T15. |
| 7 | RLS penetration (live) | ⬜ not verified | Task T11. |
| 8 | PayFast sandbox E2E | ⬜ not verified | Tasks T22–T23. |
| 9 | Inventory concurrency | ⬜ not verified | Task T24. |
| 10 | Email (Resend) deliverability | ⬜ not verified | Task T25. |
| 11 | DNS + TLS on both origins | ⬜ not verified | Task T30. |
| 12 | Smoke suite | ⬜ not verified | Task T31. |
| 13 | Rollback rehearsed | ⬜ not verified | Task T29. |

---

## Deferral 1 — Live carrier integration (T5)

- **Decision:** launch without a live The Courier Guy integration. Shipping rates
  are a deterministic flat-rate estimate; label generation and tracking fail
  closed.
- **Rationale:** the public API documentation does not confirm the authentication
  scheme or the shipment-creation / label / cancel paths, and no API credential
  exists yet. Implementing against guesses would breach the repository's
  fail-closed rule.
- **Accepted by:** _<owner>_ · **Accepted on:** _<date>_
- **Risk:** the quoted shipping price is an estimate and may differ from the real
  carrier price; fulfilment labels must be created manually in the carrier portal
  until the integration lands.
- **Mitigations in place:** `isEstimate: true` on the quote; a structured
  `logger.warn` on every fallback use; typed `CarrierCapabilityError` for labels;
  `errorCode` on degraded tracking; the carrier mode is exposed on `/api/ready`;
  the simulated driver is rejected under `NODE_ENV=production`.
- **Revisit trigger:** when `THE_COURIER_GUY_API_KEY` is available **and** the
  authentication scheme plus the shipment/label paths are confirmed.
- **Follow-up scope (confirmed facts):** base URL `https://api-tcg.co.za`;
  `POST /rates` (D2D, needs `collection_address` + `delivery_address`);
  `GET /tracking/shipments/public?tracking_reference=<ref>`.

---

## Deferral 2 — Shared rate-limit store

- **Decision:** keep per-instance limits and pin `numInstances: 1` (ADR `0002`).
- **Accepted by:** _<owner>_ · **Accepted on:** _<date>_
- **Revisit trigger:** the moment more than one Render instance is required.

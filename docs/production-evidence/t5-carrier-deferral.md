# T5 — Carrier integration: recorded deferral + enforcement (evidence)

**Branch:** `cline/mm6qa9sn` (based on `develop` @ `96b2033`) · **Date:** 2026-10-14

## Decision

The live The Courier Guy integration is **deferred**, and the deferral is now
recorded and enforced in code rather than being an undocumented silent fallback.
The decision record is **`docs/production-evidence/go-no-go.md` → Deferral 1**.

Why deferred: the public API docs (`https://api-tcg.co.za/`) confirm the base URL,
`POST /rates` and `GET /tracking/shipments/public?tracking_reference=…`, but the
**authentication scheme** and the shipment-creation / label / cancel paths are not
documented there, and no `THE_COURIER_GUY_API_KEY` credential exists. Implementing
against guesses would breach the fail-closed rule.

## What changed

| File | Change |
|---|---|
| `src/services/shipping/carrierCapabilities.ts` *(new)* | Single source of truth for carrier capability state + the confirmed upstream API facts. |
| `src/services/shipping/carrierTypes.ts` | `ShippingRateQuote.isEstimate`, `CarrierTrackingResult.errorCode`, and the typed `CarrierCapabilityError` (with `CarrierErrorCode`). |
| `src/services/shipping/shippingService.ts` | Production quotes carry `isEstimate: true` and emit a structured `logger.warn`; labels throw `CarrierCapabilityError('CARRIER_LABEL_NOT_IMPLEMENTED')`; tracking returns `errorCode: 'CARRIER_TRACKING_NOT_IMPLEMENTED'`. |
| `src/lib/healthCheck.ts` | `/api/ready` reports `checks.carrier`. |
| `README.md` | Replaced the "silent flat rate" caveat with the enforced behaviour table. |

The previous silent-fallback risk is closed: the estimate is flagged on the quote
and logged on every use.

## Live proof (`NODE_ENV=production node dist/server.cjs`)

`GET /api/ready`:

    "checks": { ..., "carrier": "rates=flat_rate_fallback,labels=not_implemented,tracking=not_implemented" }

`POST /api/shipping/rates` (with a valid CSRF token):

    {"success":true,"quotes":[{"rateId":"prod-flat-rate-estimate","carrierId":"the_courier_guy",
     "serviceName":"Flat Rate Estimate (Production Fallback)","rateZar":200,"currency":"ZAR",
     "isInsured":false,"isEstimate":true}]}
    status=200

Server log (the fallback is no longer silent):

    {"level":"WARN","message":"[Shipping] Flat-rate estimate used (carrier not live)",
     "carrierMode":"rates=flat_rate_fallback,labels=not_implemented,tracking=not_implemented",
     "rateZar":200,"itemsCount":1,"totalValueZar":900}

## Verification (all green)

    npx tsc --noEmit                           -> exit 0
    npx eslint . --max-warnings 0              -> exit 0
    npx vitest run --config vitest.config.ts   -> exit 0 (35 files, 127 tests)
    npm run build                              -> exit 0

New tests: `tests/unit/carrierCapabilities.test.ts` and the
`carrier deferral enforcement (T5)` block in `tests/unit/shipping-service.test.ts`
(estimate flag, typed label error, coded tracking result).

## Remaining (human)

Sign Deferral 1 in `docs/production-evidence/go-no-go.md`, or supply
`THE_COURIER_GUY_API_KEY` plus the confirmed auth scheme and shipment/label paths
so the live driver can be implemented.

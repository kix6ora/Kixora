# Kixora

Kixora is a premium sneaker e-commerce web application with a customer storefront and administrator dashboard.

## Shipping in production

**Decision (recorded deferral):** Kixora does **not** call a carrier API in
production yet. The status is the single source of truth in
`src/services/shipping/carrierCapabilities.ts` and is surfaced on `/api/ready`
as `carrier`.

| Capability | State | Behaviour |
|---|---|---|
| Rates | `flat_rate_fallback` | A deterministic flat-rate estimate from `src/services/shipping/flatRate.ts` (R200 flat for South Africa; free when (subtotal − discount) > R2000; exactly R2000 pays R200; empty cart is R0). The quote carries `isEstimate: true` and a structured `logger.warn` is emitted on every use. |
| Labels | `not_implemented` | `createShipmentLabel` throws `CarrierCapabilityError` with code `CARRIER_LABEL_NOT_IMPLEMENTED`. |
| Tracking | `not_implemented` | `getTracking` returns a degraded result with `errorCode: 'CARRIER_TRACKING_NOT_IMPLEMENTED'` and no fabricated events. |

**Why deferred:** the public API documentation (`https://api-tcg.co.za/`) confirms
the base URL, `POST /rates` and
`GET /tracking/shipments/public?tracking_reference=…`, but the authentication
scheme and the shipment-creation / label / cancel paths are not documented there,
and no `THE_COURIER_GUY_API_KEY` credential exists yet. Implementing against
guesses would breach the fail-closed rule, so this is an accepted go/no-go
deferral — see `docs/production-evidence/go-no-go.md`.

The flat rate is no longer *silent*: it is flagged on the quote and logged. The
previous caveat ("no warning or metric is emitted when it is used") is fixed.

Live carrier integration (real rates, waybills, tracking) remains open and needs
the credential plus a scoped implementation task.


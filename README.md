# Kixora

Kixora is a premium sneaker e-commerce web application with a customer storefront and administrator dashboard.

## Shipping in production

**Decision:** in production, shipping quotes come from a deterministic flat rate in
`src/services/shipping/flatRate.ts` (R200 flat for all of South Africa; free when
(subtotal minus discount) is strictly greater than R2000; exactly R2000 pays R200;
empty cart is R0), returned in ZAR as a single `prod-flat-rate-estimate` quote. The
service does not call carrier APIs in production and does not throw when carrier credentials are
missing.

**Caveat:** this fallback is a **silent flat rate that may differ from real carrier prices** — no
warning or metric is emitted when it is used. Live carrier integration (real rates, labels,
tracking) is not implemented; `createShipmentLabel` throws in production and tracking returns a
static `PENDING_PICKUP` placeholder.

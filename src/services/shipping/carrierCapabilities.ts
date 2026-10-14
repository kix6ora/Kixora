/**
 * The Courier Guy integration status — single source of truth.
 *
 * Kixora does NOT call The Courier Guy in production today: rates come from a
 * deterministic flat-rate table, and labels/tracking fail closed. This is a
 * recorded go/no-go deferral — see docs/production-evidence/go-no-go.md.
 *
 * Confirmed upstream facts (from the public docs at https://api-tcg.co.za/) so
 * the follow-up implementation is scoped:
 *   - Base URL: https://api-tcg.co.za
 *   - POST /rates  (D2D quote; requires collection_address + delivery_address,
 *     each with lat/lng/street_address/city/zone/country/type)
 *   - GET  /tracking/shipments/public?tracking_reference=<ref>  (tracking)
 *   - Shipment creation, the label/waybill PDF and cancel endpoints exist, but
 *     their exact paths and the authentication scheme are NOT confirmed by the
 *     public documentation available at the time of writing.
 *   - Requires a THE_COURIER_GUY_API_KEY credential (human action).
 */

export type CarrierCapabilityState = 'live' | 'flat_rate_fallback' | 'not_implemented';

export interface CarrierIntegrationStatus {
  provider: 'the_courier_guy';
  providerName: string;
  rates: CarrierCapabilityState;
  labels: CarrierCapabilityState;
  tracking: CarrierCapabilityState;
  /** True while any capability is not live. */
  deferred: boolean;
  /** The human action required before this can go live. */
  requiresCredential: 'THE_COURIER_GUY_API_KEY';
}

export const CARRIER_INTEGRATION_STATUS: CarrierIntegrationStatus = {
  provider: 'the_courier_guy',
  providerName: 'The Courier Guy',
  rates: 'flat_rate_fallback',
  labels: 'not_implemented',
  tracking: 'not_implemented',
  deferred: true,
  requiresCredential: 'THE_COURIER_GUY_API_KEY',
};

/** One-line operator summary for /api/ready and startup logs. */
export function describeCarrierMode(): string {
  return `rates=${CARRIER_INTEGRATION_STATUS.rates},labels=${CARRIER_INTEGRATION_STATUS.labels},tracking=${CARRIER_INTEGRATION_STATUS.tracking}`;
}

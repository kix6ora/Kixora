// Kixora flat-rate shipping (Phase 3)
// Single source of truth for client-side shipping estimates.
// Server authority remains Supabase RPC `place_order_atomic` /
// `create_pending_order_atomic` (see 0037_flat_rate_shipping.sql).
// Business rule: R200 flat for all SA orders; R0 when
// (subtotal - discount) is strictly greater than R2000; R0 for empty carts.

export const SHIPPING_FLAT_RATE = 200;
export const FREE_SHIPPING_THRESHOLD = 2000;

/**
 * Returns the flat-rate shipping fee in rands.
 * @param subtotalAfterDiscount subtotal AFTER promo discount
 * @param itemCount optional cart item count; 0 forces free (empty cart)
 */
export function calculateShipping(subtotalAfterDiscount: number, itemCount?: number): number {
  if (typeof itemCount === 'number' && itemCount <= 0) {
    return 0;
  }
  if (subtotalAfterDiscount > FREE_SHIPPING_THRESHOLD) {
    return 0;
  }
  return SHIPPING_FLAT_RATE;
}

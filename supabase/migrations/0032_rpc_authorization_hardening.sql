-- Kixora: restrict high-impact commerce RPCs to trusted callers.
-- Forward-only hardening; this migration does not alter existing order data.

ALTER FUNCTION public.confirm_inventory_sale(UUID, TEXT)
  SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.confirm_inventory_sale(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_inventory_sale(UUID, TEXT)
  TO service_role;

ALTER FUNCTION public.release_order_reservations(UUID, TEXT)
  SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.release_order_reservations(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_order_reservations(UUID, TEXT)
  TO service_role;

-- Admin console calls this RPC with an authenticated JWT. The function checks
-- admin status internally and bounds caller input before it can mutate orders.
CREATE OR REPLACE FUNCTION public.cleanup_stale_pending_orders(
  p_ttl_minutes INTEGER DEFAULT 60
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order_id UUID;
  v_count INT := 0;
  v_released BOOLEAN;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_ttl_minutes IS NULL OR p_ttl_minutes < 1 OR p_ttl_minutes > 1440 THEN
    RAISE EXCEPTION 'TTL must be between 1 and 1440 minutes.'
      USING ERRCODE = '22023';
  END IF;

  FOR v_order_id IN
    SELECT id
    FROM public.orders
    WHERE current_status = 'Pending'
      AND payment_status = 'pending'
      AND created_at < (NOW() - (p_ttl_minutes * INTERVAL '1 minute'))
    FOR UPDATE SKIP LOCKED
  LOOP
    v_released := public.release_order_reservations(
      v_order_id,
      'System auto-expiration of stale pending order'
    );

    IF v_released THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_pending_orders(INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_pending_orders(INTEGER)
  TO authenticated, service_role;



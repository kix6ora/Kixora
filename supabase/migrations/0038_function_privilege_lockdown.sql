-- supabase/migrations/0038_function_privilege_lockdown.sql
-- ==============================================================================
-- KIXORA DATABASE MIGRATION: 0038 - FUNCTION PRIVILEGE LOCKDOWN & SEARCH_PATH PINNING
-- Description: Tighten EXECUTE privileges for sensitive RPCs and trigger functions,
--              pin search_path for security, and add an admin/service_role guard to
--              cleanup_stale_pending_orders.
-- Notes:
--  - Do NOT modify applied migrations (0001-0037).
--  - Do NOT revoke EXECUTE on is_admin(), is_super_admin(), get_auth_role().
--  - Do NOT change privileges for place_order_atomic or validate_promo_code.
--  - place_order_atomic(...) and create_pending_order_atomic(...) require 'extensions'
--    in their search_path because they call gen_random_bytes() unqualified.
-- ==============================================================================

-- ============================================================================
-- A) Revoke from public / anon / authenticated; grant to service_role
--    (caller-only functions that must run only via service-role or internal code)
-- ============================================================================

-- 1. confirm_inventory_sale(uuid, text)
REVOKE EXECUTE ON FUNCTION public.confirm_inventory_sale(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_inventory_sale(uuid, text)
  TO service_role;

-- 2. release_order_reservations(uuid, text)
REVOKE EXECUTE ON FUNCTION public.release_order_reservations(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_order_reservations(uuid, text)
  TO service_role;

-- 3. cleanup_expired_reservations()
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_reservations()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_reservations()
  TO service_role;

-- 4. create_pending_order_atomic(uuid, text, jsonb, jsonb, text, text, text, integer)
REVOKE EXECUTE ON FUNCTION public.create_pending_order_atomic(uuid, text, jsonb, jsonb, text, text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pending_order_atomic(uuid, text, jsonb, jsonb, text, text, text, integer)
  TO service_role;

-- ============================================================================
-- B) Trigger / lifecycle functions: remove client EXECUTE (public / anon / authenticated)
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.sync_profile_role_to_auth()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.guard_role_escalation()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.guard_immutable_order_fields()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_updated_at()
  FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- C) Admin RPCs: revoke execute from public and anon; keep authenticated; grant service_role
--    Additionally: redefine cleanup_stale_pending_orders with an admin/service_role guard
-- ============================================================================

-- 1. admin_adjust_inventory(uuid, integer, uuid, text)
REVOKE EXECUTE ON FUNCTION public.admin_adjust_inventory(uuid, integer, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_inventory(uuid, integer, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_inventory(uuid, integer, uuid, text)
  TO service_role;

-- 2. admin_reconcile_payment_state(uuid, text, text, text, uuid, text, jsonb)
REVOKE EXECUTE ON FUNCTION public.admin_reconcile_payment_state(uuid, text, text, text, uuid, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_payment_state(uuid, text, text, text, uuid, text, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_payment_state(uuid, text, text, text, uuid, text, jsonb)
  TO service_role;

-- 3. admin_transition_order_status(uuid, text, text, text, uuid)
REVOKE EXECUTE ON FUNCTION public.admin_transition_order_status(uuid, text, text, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_transition_order_status(uuid, text, text, text, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transition_order_status(uuid, text, text, text, uuid)
  TO service_role;

-- 4. cleanup_stale_pending_orders(integer)
-- Redefine with the same body as migration 0016_reconciliation_refinements.sql
-- but add an explicit guard to block non-admin/non-service_role callers.
CREATE OR REPLACE FUNCTION public.cleanup_stale_pending_orders(
  p_ttl_minutes INTEGER DEFAULT 60
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_count INT := 0;
BEGIN
  -- Guard: allow only admins or the service_role to run this RPC
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  FOR v_order_id IN
    SELECT id FROM public.orders
    WHERE current_status = 'Pending'
      AND payment_status = 'pending'
      AND created_at < (NOW() - (p_ttl_minutes * interval '1 minute'))
    FOR UPDATE SKIP LOCKED
  LOOP
    -- 1. Release any reservations if they exist
    PERFORM public.release_order_reservations(v_order_id, 'System auto-expiration of stale pending order');

    -- 2. Transition order state
    UPDATE public.orders
    SET current_status = 'Cancelled',
        payment_status = 'failed',
        updated_at = NOW()
    WHERE id = v_order_id;

    -- 3. Log history
    INSERT INTO public.order_status_history (order_id, status, title, description)
    VALUES (
      v_order_id,
      'Cancelled',
      'Order Expired (Stale)',
      'Payment was not detected within ' || p_ttl_minutes || ' minutes. Order automatically released from vault.'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_stale_pending_orders(integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_pending_orders(integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_pending_orders(integer)
  TO service_role;

-- ============================================================================
-- D) Pin search_path for listed functions
--    - Default: SET search_path = public, pg_temp
--    - Exception: functions that call gen_random_bytes() unqualified must include 'extensions'
--      in their search_path: place_order_atomic(...), create_pending_order_atomic(...)
-- ============================================================================

-- Trigger / lifecycle / utility functions
ALTER FUNCTION public.sync_profile_role_to_auth() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;

-- Promo validation (keep privileges unchanged; pin search_path)
ALTER FUNCTION public.validate_promo_code(text, numeric) SET search_path = public, pg_temp;

-- create_pending_order_atomic needs 'extensions' for gen_random_bytes()
ALTER FUNCTION public.create_pending_order_atomic(uuid, text, jsonb, jsonb, text, text, text, integer)
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.guard_immutable_order_fields() SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_stale_pending_orders(integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_reconcile_payment_state(uuid, text, text, text, uuid, text, jsonb) SET search_path = public, pg_temp;

-- place_order_atomic needs 'extensions' for gen_random_bytes()
ALTER FUNCTION public.place_order_atomic(uuid, text, jsonb, jsonb, text, text, text, text)
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.confirm_inventory_sale(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_guest_order_secure(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.release_order_reservations(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.guard_role_escalation() SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_transition_order_status(uuid, text, text, text, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_expired_reservations() SET search_path = public, pg_temp;
ALTER FUNCTION public.admin_adjust_inventory(uuid, integer, uuid, text) SET search_path = public, pg_temp;

-- ============================================================================
-- End of migration 0038
-- ============================================================================

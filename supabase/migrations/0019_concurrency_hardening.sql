-- ==============================================================================
-- KIXORA DATABASE MIGRATION: 0018 - CONCURRENCY & RECONCILIATION HARDENING
-- Description: Enforces strict order status locking and state transition guards
--              to prevent race conditions between success and failure webhooks.
-- ==============================================================================

-- 1. Redefine confirm_inventory_sale to lock order row and check status
CREATE OR REPLACE FUNCTION public.confirm_inventory_sale(
  p_order_id UUID,
  p_payment_reference TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_res RECORD;
  v_item RECORD;
  v_confirmed_count INT := 0;
BEGIN
  -- Row-level lock on order to prevent concurrent updates from other webhooks
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  -- 1. Idempotency check: if already paid, return success
  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Order already paid', 'idempotent', true);
  END IF;

  -- 2. State Guard: Only allow confirmation if order is in a valid state
  -- If it's already 'Cancelled', we cannot confirm it (inventory was likely released)
  IF v_order.current_status = 'Cancelled' THEN
    RAISE EXCEPTION 'Cannot confirm sale for order %: order is already Cancelled', p_order_id;
  END IF;

  -- 3. Atomic transition from Reservation to Sold
  FOR v_res IN
    SELECT * FROM public.inventory_reservations
    WHERE order_id = p_order_id AND status = 'active'
    FOR UPDATE
  LOOP
    -- Decrement actual stock and clear reservation
    UPDATE public.inventory
    SET stock = GREATEST(0, stock - v_res.quantity),
        reserved_stock = GREATEST(0, reserved_stock - v_res.quantity),
        updated_at = NOW()
    WHERE product_size_id = v_res.product_size_id;

    UPDATE public.inventory_reservations
    SET status = 'confirmed',
        updated_at = NOW()
    WHERE id = v_res.id;
    
    v_confirmed_count := v_confirmed_count + 1;
  END LOOP;

  -- 4. Safety Check: If no active reservations found, we might have a data inconsistency
  -- unless it's a digital order (Kixora only sells physical sneakers so far)
  IF v_confirmed_count = 0 THEN
    RAISE EXCEPTION 'No active inventory reservations found for order %', p_order_id;
  END IF;

  -- 5. Increment product sales counts
  FOR v_item IN
    SELECT product_id, SUM(quantity) as total_qty
    FROM public.order_items
    WHERE order_id = p_order_id
    GROUP BY product_id
  LOOP
    UPDATE public.products
    SET sales_count = sales_count + v_item.total_qty,
        updated_at = NOW()
    WHERE id = v_item.product_id;
  END LOOP;

  -- 6. Transition Order State
  UPDATE public.orders
  SET payment_status = 'paid',
      payment_reference = COALESCE(p_payment_reference, payment_reference),
      current_status = 'Authenticated',
      updated_at = NOW()
  WHERE id = p_order_id;

  -- 7. Insert Status History
  INSERT INTO public.order_status_history (order_id, status, notes)
  VALUES (p_order_id, 'Authenticated', 'Payment successfully captured and inventory finalized (Atomic RPC).');

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'payment_status', 'paid',
    'current_status', 'Authenticated',
    'reservations_confirmed', v_confirmed_count
  );
END;
$$;

-- 2. Redefine release_order_reservations to lock order row
CREATE OR REPLACE FUNCTION public.release_order_reservations(
  p_order_id UUID,
  p_reason TEXT DEFAULT 'Order cancelled or expired'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_res RECORD;
  v_order RECORD;
BEGIN
  -- Lock the order row to prevent racing with confirm_inventory_sale
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  -- Only allow release if order is NOT paid
  IF v_order.payment_status = 'paid' THEN
    RETURN false;
  END IF;

  FOR v_res IN
    SELECT * FROM public.inventory_reservations
    WHERE order_id = p_order_id AND status = 'active'
    FOR UPDATE
  LOOP
    UPDATE public.inventory
    SET reserved_stock = GREATEST(0, reserved_stock - v_res.quantity),
        updated_at = NOW()
    WHERE product_size_id = v_res.product_size_id;

    UPDATE public.inventory_reservations
    SET status = 'released',
        updated_at = NOW()
    WHERE id = v_res.id;
  END LOOP;

  -- Update order status if it hasn't been updated yet
  IF v_order.current_status <> 'Cancelled' THEN
    UPDATE public.orders
    SET current_status = 'Cancelled',
        payment_status = 'failed',
        updated_at = NOW()
    WHERE id = p_order_id;
    
    INSERT INTO public.order_status_history (order_id, status, notes)
    VALUES (p_order_id, 'Cancelled', p_reason || ' (Atomic Inventory Release)');
  END IF;

  RETURN true;
END;
$$;

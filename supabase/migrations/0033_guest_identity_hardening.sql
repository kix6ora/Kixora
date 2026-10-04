-- Kixora: prevent guest account impersonation and require a guest capability for lookup.
-- Forward-only; keeps the checkout contract and order result payload unchanged.

CREATE OR REPLACE FUNCTION public.place_order_atomic(
  p_user_id UUID,
  p_guest_session_token TEXT,
  p_customer_info JSONB,
  p_cart_items JSONB,
  p_promo_code TEXT DEFAULT NULL,
  p_shipping_method TEXT DEFAULT 'Express Vault Courier',
  p_payment_method TEXT DEFAULT 'Credit / Debit Card',
  p_payment_reference TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_item RECORD;
  v_product_size_id UUID;
  v_product_name TEXT;
  v_product_sku TEXT;
  v_server_price NUMERIC(10,2);
  v_image_url TEXT;
  v_stock INT;
  v_reserved_stock INT;
  v_available_stock INT;
  v_subtotal NUMERIC(10,2) := 0;
  v_discount NUMERIC(10,2) := 0;
  v_shipping_fee NUMERIC(10,2) := 0;
  v_total NUMERIC(10,2) := 0;
  v_promo RECORD;
  v_promo_id UUID := NULL;
  v_order_id UUID;
  v_order_code TEXT;
  v_tracking_number TEXT;
  v_guest_access_token TEXT;
  v_resolved_user_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF p_cart_items IS NULL OR jsonb_array_length(p_cart_items) = 0 THEN
    RAISE EXCEPTION 'Cart cannot be empty';
  END IF;

  -- Resolve authenticated user
  IF auth.uid() IS NOT NULL THEN
    v_resolved_user_id := auth.uid();
  ELSIF p_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Guest checkout cannot assign an account user ID.'
      USING ERRCODE = '42501';
  ELSE
    v_resolved_user_id := NULL;
  END IF;

  v_expires_at := NOW() + interval '30 minutes';

  -- 1. Collision-Free Order Code Generation
  LOOP
    v_order_code := 'KXO-' || LPAD((FLOOR(1000 + RANDOM() * 9000))::TEXT, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE order_code = v_order_code);
  END LOOP;

  -- 2. Collision-Free Tracking Number Generation
  LOOP
    v_tracking_number := 'KX-' || LPAD((FLOOR(10000000 + RANDOM() * 90000000))::TEXT, 8, '0') || '-ZA';
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.shipments WHERE tracking_number = v_tracking_number);
  END LOOP;

  v_guest_access_token := encode(gen_random_bytes(24), 'hex');

  -- 3. Lock Inventory Rows & Create Reservations (NOT direct decrement)
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_cart_items) AS x(
    product_id UUID,
    size_us NUMERIC(3,1),
    quantity INT,
    bespoke_config JSONB
  )
  LOOP
    SELECT ps.id, p.name, p.sku, p.price,
           COALESCE(
             (SELECT pi.image_url FROM public.product_images pi WHERE pi.product_id = p.id ORDER BY pi.display_order ASC LIMIT 1),
             'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1000&q=85'
           ) AS image_url,
           i.stock, i.reserved_stock
    INTO v_product_size_id, v_product_name, v_product_sku, v_server_price, v_image_url, v_stock, v_reserved_stock
    FROM public.product_sizes ps
    JOIN public.products p ON p.id = ps.product_id
    JOIN public.inventory i ON i.product_size_id = ps.id
    WHERE ps.product_id = v_item.product_id AND ps.size_us = v_item.size_us
    FOR UPDATE OF i;

    IF v_product_size_id IS NULL THEN
      RAISE EXCEPTION 'Product size US % not found for product %', v_item.size_us, v_item.product_id;
    END IF;

    v_available_stock := v_stock - v_reserved_stock;
    IF v_available_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for % (US %). Only % pair(s) available.',
        v_product_name, v_item.size_us, GREATEST(0, v_available_stock);
    END IF;

    -- Increment Reserved Stock (NOT decrementing stock yet)
    UPDATE public.inventory
    SET reserved_stock = reserved_stock + v_item.quantity,
        updated_at = NOW()
    WHERE product_size_id = v_product_size_id;

    v_subtotal := v_subtotal + (v_server_price * v_item.quantity);
  END LOOP;

  -- 4. Server-Side Promo Code Validation
  IF p_promo_code IS NOT NULL AND TRIM(p_promo_code) <> '' THEN
    SELECT * INTO v_promo
    FROM public.promo_codes
    WHERE code = UPPER(TRIM(p_promo_code))
    FOR UPDATE;

    IF v_promo.id IS NULL OR NOT v_promo.is_active
       OR (v_promo.starts_at > NOW())
       OR (v_promo.expires_at IS NOT NULL AND v_promo.expires_at <= NOW())
       OR (v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses) THEN
      RAISE EXCEPTION 'Promo code % is invalid or expired', p_promo_code;
    END IF;

    IF v_subtotal < v_promo.min_spend THEN
      RAISE EXCEPTION 'Minimum spend of R% required for code %', v_promo.min_spend, v_promo.code;
    END IF;

    v_promo_id := v_promo.id;
    v_discount := ROUND((v_subtotal * v_promo.discount_percent) / 100.0, 2);

    UPDATE public.promo_codes
    SET current_uses = current_uses + 1
    WHERE id = v_promo_id;
  END IF;

  -- 5. Shipping Fee Calculation
  IF v_subtotal >= 2000.00 THEN
    v_shipping_fee := 0.00;
  ELSE
    v_shipping_fee := 150.00;
  END IF;

  v_total := GREATEST(0, v_subtotal - v_discount + v_shipping_fee);

  -- 6. Insert Order (Payment status is ALWAYS pending initially)
  INSERT INTO public.orders (
    order_code,
    guest_access_token,
    user_id,
    customer_snapshot,
    subtotal,
    discount,
    shipping_fee,
    tax,
    total,
    payment_method,
    shipping_method,
    payment_status,
    payment_reference,
    current_status
  ) VALUES (
    v_order_code,
    v_guest_access_token,
    v_resolved_user_id,
    p_customer_info,
    v_subtotal,
    v_discount,
    v_shipping_fee,
    0.00,
    v_total,
    p_payment_method,
    p_shipping_method,
    'pending', -- ALWAYS pending until webhook
    p_payment_reference, -- Intent ID stored for reconciliation
    'Pending' -- ALWAYS Pending until payment success
  ) RETURNING id INTO v_order_id;

  -- 7. Insert Order Line Items & Reservations
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_cart_items) AS x(
    product_id UUID,
    size_us NUMERIC(3,1),
    quantity INT,
    bespoke_config JSONB
  )
  LOOP
    SELECT ps.id, p.name, p.sku, p.price,
           COALESCE(
             (SELECT pi.image_url FROM public.product_images pi WHERE pi.product_id = p.id ORDER BY pi.display_order ASC LIMIT 1),
             'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1000&q=85'
           ) AS image_url
    INTO v_product_size_id, v_product_name, v_product_sku, v_server_price, v_image_url
    FROM public.product_sizes ps
    JOIN public.products p ON p.id = ps.product_id
    WHERE ps.product_id = v_item.product_id AND ps.size_us = v_item.size_us;

    -- Create Inventory Reservation record
    INSERT INTO public.inventory_reservations (
      product_size_id,
      order_id,
      guest_session_token,
      user_id,
      quantity,
      status,
      expires_at
    ) VALUES (
      v_product_size_id,
      v_order_id,
      p_guest_session_token,
      v_resolved_user_id,
      v_item.quantity,
      'active',
      v_expires_at
    );

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      product_sku,
      size_us,
      unit_price,
      quantity,
      bespoke_snapshot,
      image_url
    ) VALUES (
      v_order_id,
      v_item.product_id,
      v_product_name,
      v_product_sku,
      v_item.size_us,
      v_server_price,
      v_item.quantity,
      v_item.bespoke_config,
      v_image_url
    );
  END LOOP;

  -- 8. Insert Shipment
  INSERT INTO public.shipments (order_id, tracking_number)
  VALUES (v_order_id, v_tracking_number);

  -- 9. Insert Status History
  INSERT INTO public.order_status_history (order_id, status, title, description)
  VALUES (
    v_order_id,
    'Pending',
    'Order Placed & Vault Reserved',
    'Order received and inventory reserved. Awaiting payment authorization from 12-point vault protocol.'
  );

  -- 10. Record Promo Redemption
  IF v_promo_id IS NOT NULL THEN
    INSERT INTO public.promo_redemptions (promo_id, order_id, user_id, discount_amount)
    VALUES (v_promo_id, v_order_id, v_resolved_user_id, v_discount);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_code', v_order_code,
    'guest_access_token', v_guest_access_token,
    'tracking_number', v_tracking_number,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'shipping_fee', v_shipping_fee,
    'total', v_total,
    'payment_status', 'pending',
    'current_status', 'Pending'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_guest_order_secure(
  p_order_code TEXT,
  p_token_or_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_order RECORD;
  v_items JSONB;
  v_history JSONB;
  v_shipment RECORD;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE order_code = UPPER(TRIM(p_order_code))
    AND (
      guest_access_token = TRIM(p_token_or_email)
      OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR public.is_admin()
    );

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found or invalid credentials');
  END IF;

  SELECT jsonb_agg(to_jsonb(oi)) INTO v_items
  FROM public.order_items oi
  WHERE oi.order_id = v_order.id;

  SELECT jsonb_agg(to_jsonb(h) ORDER BY h.created_at ASC) INTO v_history
  FROM public.order_status_history h
  WHERE h.order_id = v_order.id;

  SELECT * INTO v_shipment
  FROM public.shipments
  WHERE order_id = v_order.id;

  RETURN jsonb_build_object(
    'success', true,
    'order', jsonb_build_object(
      'id', v_order.id,
      'order_code', v_order.order_code,
      'customer_snapshot', v_order.customer_snapshot,
      'subtotal', v_order.subtotal,
      'discount', v_order.discount,
      'shipping_fee', v_order.shipping_fee,
      'total', v_order.total,
      'payment_method', v_order.payment_method,
      'shipping_method', v_order.shipping_method,
      'payment_status', v_order.payment_status,
      'current_status', v_order.current_status,
      'created_at', v_order.created_at
    ),
    'items', COALESCE(v_items, '[]'::jsonb),
    'history', COALESCE(v_history, '[]'::jsonb),
    'shipment', to_jsonb(v_shipment)
  );
END;
$$;

-- This legacy RPC has no application caller; prevent direct Data API invocation.
REVOKE ALL ON FUNCTION public.create_pending_order_atomic(
  UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, INTEGER
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pending_order_atomic(
  UUID, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, INTEGER
) TO service_role;


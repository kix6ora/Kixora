-- ==============================================================================
-- KIXORA DATABASE MIGRATION: 0023 - RLS HARDENING & PENETRATION MITIGATION
-- Description: Hardens Row-Level Security across storage buckets, bespoke designs,
--              cart boundaries, order isolation, and role guard triggers.
-- ==============================================================================

-- 1. BESPOKE DESIGNS RLS HARDENING
DROP POLICY IF EXISTS "Bespoke designs viewable by creator or admin" ON public.bespoke_designs;
CREATE POLICY "Bespoke designs viewable by creator or admin"
  ON public.bespoke_designs FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (user_id IS NULL)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Users or guests can create bespoke designs" ON public.bespoke_designs;
CREATE POLICY "Users or guests can create bespoke designs"
  ON public.bespoke_designs FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR (auth.uid() IS NULL AND user_id IS NULL)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Users can update own bespoke designs" ON public.bespoke_designs;
CREATE POLICY "Users can update own bespoke designs"
  ON public.bespoke_designs FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR public.is_admin()
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Users can delete own bespoke designs" ON public.bespoke_designs;
CREATE POLICY "Users can delete own bespoke designs"
  ON public.bespoke_designs FOR DELETE
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR public.is_admin()
  );

-- 2. CARTS & CART ITEMS RIGID BOUNDARY ISOLATION
DROP POLICY IF EXISTS "Users can manage own authenticated cart" ON public.carts;
CREATE POLICY "Users can manage own authenticated cart"
  ON public.carts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Cart items accessible via authorized cart" ON public.cart_items;
CREATE POLICY "Cart items accessible via authorized cart"
  ON public.cart_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_items.cart_id
        AND c.user_id = auth.uid()
    )
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carts c
      WHERE c.id = cart_items.cart_id
        AND c.user_id = auth.uid()
    )
    OR public.is_admin()
  );

-- 3. ORDERS & ORDER ITEMS ISOLATION (IMMUTABLE CLIENT ACCESS)
DROP POLICY IF EXISTS "Users view own orders or Admin views all" ON public.orders;
CREATE POLICY "Users view own orders or Admin views all"
  ON public.orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Direct order insert disabled" ON public.orders;
CREATE POLICY "Direct order insert disabled"
  ON public.orders FOR INSERT
  WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Direct order delete disabled" ON public.orders;
CREATE POLICY "Direct order delete disabled"
  ON public.orders FOR DELETE
  USING (public.is_admin() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Order items viewable by order owner or admin" ON public.order_items;
CREATE POLICY "Order items viewable by order owner or admin"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.user_id = auth.uid() OR public.is_admin())
    )
  );

-- 4. STORAGE OBJECTS HARDENED RLS POLICIES
-- A. Product Images Bucket: Strict Public Read, Admin Write Only
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
CREATE POLICY "Admins can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images' 
    AND (public.is_admin() OR auth.role() = 'service_role')
  );

DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
CREATE POLICY "Admins can update product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images' 
    AND (public.is_admin() OR auth.role() = 'service_role')
  )
  WITH CHECK (
    bucket_id = 'product-images' 
    AND (public.is_admin() OR auth.role() = 'service_role')
  );

DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
CREATE POLICY "Admins can delete product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images' 
    AND (public.is_admin() OR auth.role() = 'service_role')
  );

-- B. Customizer Renders Bucket: Public Read, Auth Insert Under User Folder, Owner/Admin Mutate
DROP POLICY IF EXISTS "Public can view customizer renders" ON storage.objects;
CREATE POLICY "Public can view customizer renders"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'customizer-renders');

DROP POLICY IF EXISTS "Authenticated users can upload customizer renders" ON storage.objects;
CREATE POLICY "Authenticated users can upload customizer renders"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'customizer-renders'
    AND (
      (auth.role() = 'authenticated' AND (auth.uid()::text = (storage.foldername(name))[1] OR (storage.foldername(name))[1] = 'renders'))
      OR public.is_admin()
      OR auth.role() = 'service_role'
    )
  );

DROP POLICY IF EXISTS "Users can update own customizer renders or admin" ON storage.objects;
CREATE POLICY "Users can update own customizer renders or admin"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'customizer-renders'
    AND (
      (auth.uid()::text = (storage.foldername(name))[1])
      OR public.is_admin()
      OR auth.role() = 'service_role'
    )
  )
  WITH CHECK (
    bucket_id = 'customizer-renders'
    AND (
      (auth.uid()::text = (storage.foldername(name))[1])
      OR public.is_admin()
      OR auth.role() = 'service_role'
    )
  );

DROP POLICY IF EXISTS "Users can delete own customizer renders or admin" ON storage.objects;
CREATE POLICY "Users can delete own customizer renders or admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'customizer-renders'
    AND (
      (auth.uid()::text = (storage.foldername(name))[1])
      OR public.is_admin()
      OR auth.role() = 'service_role'
    )
  );

-- 5. REINFORCE ROLE ESCALATION TRIGGER
CREATE OR REPLACE FUNCTION public.guard_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Strict block on non-super-admins changing role
  IF (TG_OP = 'UPDATE') AND (OLD.role IS DISTINCT FROM NEW.role) THEN
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Privilege escalation rejected: Only Super Admins can alter user roles.';
    END IF;
  END IF;

  -- Block any non-super-admin from inserting an admin or super_admin record directly
  IF (TG_OP = 'INSERT') AND (NEW.role IN ('admin', 'super_admin')) THEN
    IF NOT public.is_super_admin() THEN
      NEW.role := 'customer';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 0027_fulfillment_policies.sql
-- Drop existing admin policies (if any) and recreate them with correct distinct names.

DROP POLICY IF EXISTS admin_full_access_locations ON public.fulfillment_locations;
CREATE POLICY admin_full_access_locations ON public.fulfillment_locations
  FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS admin_full_access_channels ON public.fulfillment_channels;
CREATE POLICY admin_full_access_channels ON public.fulfillment_channels
  FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS admin_full_access_sync_logs ON public.inventory_sync_logs;
CREATE POLICY admin_full_access_sync_logs ON public.inventory_sync_logs
  FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS admin_full_access_batches ON public.fulfillment_batches;
CREATE POLICY admin_full_access_batches ON public.fulfillment_batches
  FOR ALL TO authenticated USING (public.is_admin());

-- End of 0027_fulfillment_policies.sql

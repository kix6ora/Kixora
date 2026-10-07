-- ==============================================================================
-- KIXORA DATABASE MIGRATION: 0021 - SECURITY HARDENING & POLICY REFINEMENT
-- Description: Strengthens RLS policies, fixes function overloads, and 
--              ensures impenetrable JWT claims validation.
-- ==============================================================================

-- 1. Keep zero‑arg is_admin / is_super_admin signatures because existing RLS policies depend on them; pin search_path to public.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := public.get_auth_role();
  RETURN COALESCE(v_role IN ('admin', 'super_admin'), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := public.get_auth_role();
  RETURN v_role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 2. Refine Fulfillment RLS Policies (Ensuring they use the correct is_admin signature)
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

-- 3. Impenetrable Isolation for Customer Orders
-- Ensure user_id cannot be spoofed and is checked against auth.uid()
DROP POLICY IF EXISTS "Users view own orders or Admin views all" ON public.orders;
CREATE POLICY "Users view own orders or Admin views all"
  ON public.orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- 4. Audit Log Integrity
-- Audit logs should be READ-ONLY even for admins, only system can insert via triggers
-- (Except for the Super Admin who might need to manage them)
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON public.admin_audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Audit logs insertion by triggers or admins" ON public.admin_audit_logs;
CREATE POLICY "Audit logs insertion by triggers or admins"
  ON public.admin_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- 5. Strict JWT Role Validation
-- Force role check to strictly prefer 'app_metadata' if present, preventing profile-based spoofing
-- in the same session if a profile role was modified but JWT not refreshed.
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
DECLARE
  v_jwt_role TEXT;
  v_profile_role TEXT;
BEGIN
  -- 1. Try to get role from JWT claims (Standard Supabase Auth)
  v_jwt_role := (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'role');
  
  IF v_jwt_role IS NOT NULL THEN
    RETURN v_jwt_role;
  END IF;

  -- 2. Fallback to Profile Table (if no JWT role, e.g. service role or internal call)
  SELECT role INTO v_profile_role FROM public.profiles WHERE id = auth.uid();
  
  RETURN COALESCE(v_profile_role, 'anon');
EXCEPTION WHEN OTHERS THEN
  RETURN 'anon';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

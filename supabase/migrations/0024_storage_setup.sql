-- ==============================================================================
-- KIXORA DATABASE MIGRATION: 0022 - SUPABASE STORAGE BUCKETS & RLS POLICIES
-- Description: Sets up storage buckets for product imagery, drop media, and
--              3D bespoke customizer renders with granular RLS access control.
-- ==============================================================================

-- 1. INSERT STORAGE BUCKETS (IF NOT EXISTS)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  (
    'product-images',
    'product-images',
    true,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
  ),
  (
    'drop-media',
    'drop-media',
    true,
    20971520, -- 20MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
  ),
  (
    'customizer-renders',
    'customizer-renders',
    true,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO NOTHING;

-- 2. ENABLE RLS ON STORAGE OBJECTS
-- RLS on storage.objects is enabled by Supabase; no need to alter.

-- 3. STORAGE ACCESS POLICIES: PUBLIC READ
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Public can view drop media" ON storage.objects;
CREATE POLICY "Public can view drop media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'drop-media');

DROP POLICY IF EXISTS "Public can view customizer renders" ON storage.objects;
CREATE POLICY "Public can view customizer renders"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'customizer-renders');

-- 4. STORAGE ACCESS POLICIES: ADMIN WRITE / DELETE
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
  );

DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
CREATE POLICY "Admins can delete product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images' 
    AND (public.is_admin() OR auth.role() = 'service_role')
  );

DROP POLICY IF EXISTS "Admins can upload drop media" ON storage.objects;
CREATE POLICY "Admins can upload drop media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'drop-media' 
    AND (public.is_admin() OR auth.role() = 'service_role')
  );

DROP POLICY IF EXISTS "Admins can delete drop media" ON storage.objects;
CREATE POLICY "Admins can delete drop media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'drop-media' 
    AND (public.is_admin() OR auth.role() = 'service_role')
  );

-- 5. STORAGE ACCESS POLICIES: CUSTOMIZER RENDERS (Authenticated Users & Admins)
DROP POLICY IF EXISTS "Authenticated users can upload customizer renders" ON storage.objects;
CREATE POLICY "Authenticated users can upload customizer renders"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'customizer-renders'
    AND (auth.role() = 'authenticated' OR public.is_admin() OR auth.role() = 'service_role')
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

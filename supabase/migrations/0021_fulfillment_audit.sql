-- ==============================================================================
-- KIXORA DATABASE MIGRATION: 0020 - MULTI-CHANNEL FULFILLMENT & INVENTORY SYNC
-- Description: External channels, multi-location support, and reconciliation logs.
-- ==============================================================================

-- 1. Fulfillment Locations (Warehouses / Dispatch Centers)
CREATE TABLE IF NOT EXISTS public.fulfillment_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE, -- e.g., 'WH-ZA-01'
  address JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Fulfillment Channels (External 3PLs / Marketplaces)
CREATE TABLE IF NOT EXISTS public.fulfillment_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  provider_type TEXT NOT NULL, -- e.g., 'local', '3pl-vault', 'shopify-sync'
  api_config JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Inventory Sync Audit Logs
CREATE TABLE IF NOT EXISTS public.inventory_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_size_id UUID NOT NULL REFERENCES public.product_sizes(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.fulfillment_locations(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES public.fulfillment_channels(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- 'reconciliation', 'external_sale', 'internal_restock'
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  discrepancy INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_product ON public.inventory_sync_logs(product_size_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_type ON public.inventory_sync_logs(event_type);

-- 4. Fulfillment Batches (Admin Bulk Dispatching)
CREATE TABLE IF NOT EXISTS public.fulfillment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'completed', 'failed')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Extend Orders for Fulfillment Batching
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_batch_id UUID REFERENCES public.fulfillment_batches(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_location_id UUID REFERENCES public.fulfillment_locations(id) ON DELETE SET NULL;

-- 6. Seed Default Location
INSERT INTO public.fulfillment_locations (name, code, address)
VALUES ('Kixora Vault HQ', 'KXO-HQ-01', '{"city": "Johannesburg", "country": "South Africa"}')
ON CONFLICT (code) DO NOTHING;

-- 7. Seed Default Local Channel
INSERT INTO public.fulfillment_channels (name, provider_type)
VALUES ('Kixora Direct', 'local')
ON CONFLICT (name) DO NOTHING;

-- RLS for new tables
ALTER TABLE public.fulfillment_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_batches ENABLE ROW LEVEL SECURITY;

-- Admin-only policies

CREATE POLICY admin_full_access_locations ON public.fulfillment_locations
  FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY admin_full_access_channels ON public.fulfillment_channels
  FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY admin_full_access_sync_logs ON public.inventory_sync_logs
  FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY admin_full_access_batches ON public.fulfillment_batches
  FOR ALL TO authenticated USING (public.is_admin());
-- Read-only for authenticated users (optional, if needed for some UI)
-- ...

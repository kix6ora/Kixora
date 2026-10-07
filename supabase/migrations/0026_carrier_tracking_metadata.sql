-- ==============================================================================
-- KIXORA DATABASE MIGRATION: 0024 - CARRIER SHIPPING & TRACKING METADATA
-- Description: Extends orders and shipments with carrier metadata, waybill references,
--              label URLs, and tracking status synchronization.
-- ==============================================================================

-- 1. Extend shipments with carrier waybill details and tracking URLs
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS waybill_id TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS label_url TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS carrier_status TEXT DEFAULT 'pending_pickup';
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS last_status_update TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS raw_webhook_payload JSONB;

-- 2. Extend orders with direct courier tracking cache
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS carrier TEXT DEFAULT 'Vault Priority Express';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;

-- 3. Create index for fast carrier tracking lookups
CREATE INDEX IF NOT EXISTS idx_shipments_waybill ON public.shipments(waybill_id);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON public.orders(tracking_number);

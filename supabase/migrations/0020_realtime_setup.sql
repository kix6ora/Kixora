-- ==============================================================================
-- KIXORA DATABASE MIGRATION: 0019 - REALTIME INFRASTRUCTURE SETUP
-- Description: Enables Supabase Realtime for inventory and order tracking.
-- ==============================================================================

-- 1. ENABLE REALTIME FOR TARGET TABLES
-- Note: 'supabase_realtime' publication is managed by Supabase.
-- We add our tables to it to enable broadcasting changes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'inventory'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'order_status_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'shipments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;
  END IF;
END $$;

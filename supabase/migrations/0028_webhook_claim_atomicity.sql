-- Kixora Phase 3: authoritative cross-instance webhook idempotency claim.

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_webhook_event(
  p_event_id TEXT,
  p_provider TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(trim(p_event_id), '') = '' OR COALESCE(trim(p_provider), '') = '' THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.webhook_events (
    event_id,
    provider,
    event_type,
    status,
    payload
  )
  VALUES (p_event_id, lower(p_provider), 'processing', 'processed', '{}'::jsonb)
  ON CONFLICT (provider, event_id) DO NOTHING;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_webhook_event(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_webhook_event(TEXT, TEXT) TO service_role;

REVOKE SELECT ON public.admin_audit_logs FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_audit_logs_for_admin(
  p_entity_type TEXT DEFAULT NULL,
  p_action_type TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT NULL,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF public.admin_audit_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT COALESCE(public.is_admin(), FALSE)
     AND NOT COALESCE(public.is_super_admin(), FALSE) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT audit_log.*
  FROM public.admin_audit_logs AS audit_log
  WHERE (p_entity_type IS NULL OR audit_log.entity_type = p_entity_type)
    AND (p_action_type IS NULL OR audit_log.action_type = p_action_type)
    AND (p_admin_id IS NULL OR audit_log.admin_id = p_admin_id)
  ORDER BY audit_log.created_at DESC
  LIMIT p_limit
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_audit_logs_for_admin(TEXT, TEXT, UUID, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_audit_logs_for_admin(TEXT, TEXT, UUID, INTEGER, INTEGER)
  TO authenticated;
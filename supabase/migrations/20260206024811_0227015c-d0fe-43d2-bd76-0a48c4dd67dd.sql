-- First drop the existing function, then recreate with corrected logic
DROP FUNCTION IF EXISTS public.consume_import_token(UUID, TEXT, UUID);

CREATE FUNCTION public.consume_import_token(
  p_token UUID,
  p_property_id TEXT,
  p_org_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_record RECORD;
  v_remaining_ids TEXT[];
BEGIN
  -- Get the token with row lock
  SELECT * INTO v_token_record
  FROM import_tokens
  WHERE id = p_token
  FOR UPDATE;

  -- Check if token exists
  IF v_token_record IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if token is fully used (no more properties left)
  IF v_token_record.used = TRUE THEN
    RETURN FALSE;
  END IF;

  -- Check expiration
  IF v_token_record.expires_at < now() THEN
    RETURN FALSE;
  END IF;

  -- Check organization
  IF v_token_record.organization_id != p_org_id THEN
    RETURN FALSE;
  END IF;

  -- Check if property is in the allowed list
  IF NOT (p_property_id = ANY(v_token_record.source_property_ids)) THEN
    RETURN FALSE;
  END IF;

  -- Remove this property from the list (it's been consumed)
  v_remaining_ids := array_remove(v_token_record.source_property_ids, p_property_id);

  -- If no more properties left, mark token as fully used
  IF array_length(v_remaining_ids, 1) IS NULL OR array_length(v_remaining_ids, 1) = 0 THEN
    UPDATE import_tokens
    SET used = TRUE, used_at = now(), source_property_ids = v_remaining_ids
    WHERE id = p_token;
  ELSE
    -- Just update the remaining properties list
    UPDATE import_tokens
    SET source_property_ids = v_remaining_ids
    WHERE id = p_token;
  END IF;

  RETURN TRUE;
END;
$$;

-- Add a helper function to validate sync queue rules
-- Returns: 'ok' if sync can proceed, 'cancel_queued' if queued same-type should be cancelled, 'blocked' if not allowed
CREATE OR REPLACE FUNCTION public.validate_sync_queue(
  p_organization_id uuid,
  p_source_provider text DEFAULT 'imobzi'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count int;
  v_pending_count int;
  v_active_provider text;
  v_pending_id uuid;
  v_pending_provider text;
BEGIN
  -- Count active (processing/running) syncs
  SELECT count(*) INTO v_active_count
  FROM import_runs
  WHERE organization_id = p_organization_id
    AND status IN ('processing', 'running', 'starting');

  -- Get the active sync provider
  SELECT source_provider INTO v_active_provider
  FROM import_runs
  WHERE organization_id = p_organization_id
    AND status IN ('processing', 'running', 'starting')
  ORDER BY created_at DESC
  LIMIT 1;

  -- Count pending syncs
  SELECT count(*) INTO v_pending_count
  FROM import_runs
  WHERE organization_id = p_organization_id
    AND status = 'pending';

  -- Get pending sync info
  SELECT id, source_provider INTO v_pending_id, v_pending_provider
  FROM import_runs
  WHERE organization_id = p_organization_id
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no active sync, allow
  IF v_active_count = 0 THEN
    RETURN jsonb_build_object('action', 'ok', 'message', 'No active sync');
  END IF;

  -- If there's an active sync and a pending one of the same type as new request
  IF v_pending_count > 0 AND v_pending_provider = p_source_provider AND p_source_provider = v_active_provider THEN
    -- Cancel the pending one (same type conflict)
    UPDATE import_runs
    SET status = 'cancelled', finished_at = now()
    WHERE id = v_pending_id;

    RETURN jsonb_build_object(
      'action', 'cancelled_pending',
      'cancelled_id', v_pending_id,
      'message', 'Cancelled pending sync of same type'
    );
  END IF;

  -- If there's already an active + pending, block
  IF v_active_count > 0 AND v_pending_count >= 1 THEN
    RETURN jsonb_build_object('action', 'blocked', 'message', 'Queue is full (1 active + 1 pending)');
  END IF;

  -- Allow queuing
  RETURN jsonb_build_object('action', 'ok', 'message', 'Queued behind active sync');
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.validate_sync_queue(uuid, text) TO authenticated;

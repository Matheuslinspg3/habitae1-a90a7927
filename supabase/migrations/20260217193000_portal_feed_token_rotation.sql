-- A11: Periodic feed token rotation + audited manual rotation endpoint support
ALTER TABLE public.portal_feeds
  ADD COLUMN IF NOT EXISTS token_rotated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS token_rotation_days INTEGER NOT NULL DEFAULT 30;

ALTER TABLE public.portal_feeds
  ADD CONSTRAINT portal_feeds_token_rotation_days_check
  CHECK (token_rotation_days >= 1);

CREATE TABLE IF NOT EXISTS public.portal_feed_token_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES public.portal_feeds(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_by UUID,
  rotation_reason TEXT NOT NULL DEFAULT 'manual',
  old_token_fingerprint TEXT,
  new_token_fingerprint TEXT NOT NULL
);

ALTER TABLE public.portal_feed_token_rotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org feed token rotations"
ON public.portal_feed_token_rotations
FOR SELECT
USING (public.is_member_of_org(organization_id));

CREATE POLICY "Service role inserts token rotation audits"
ON public.portal_feed_token_rotations
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_portal_feed_token_rotations_feed
  ON public.portal_feed_token_rotations(feed_id, rotated_at DESC);

CREATE OR REPLACE FUNCTION public.rotate_portal_feed_token(
  p_feed_id UUID,
  p_reason TEXT DEFAULT 'manual',
  p_actor_id UUID DEFAULT auth.uid()
)
RETURNS TABLE(feed_id UUID, new_token TEXT, rotated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feed public.portal_feeds%ROWTYPE;
  v_new_token TEXT;
  v_rotated_at TIMESTAMPTZ := now();
  v_old_fingerprint TEXT;
  v_new_fingerprint TEXT;
BEGIN
  SELECT * INTO v_feed
  FROM public.portal_feeds
  WHERE id = p_feed_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feed not found';
  END IF;

  IF auth.role() <> 'service_role'
     AND (p_actor_id IS NULL OR NOT public.is_member_of_org(v_feed.organization_id)) THEN
    RAISE EXCEPTION 'Not authorized to rotate token for this feed';
  END IF;

  v_new_token := encode(gen_random_bytes(32), 'hex');
  v_old_fingerprint := CASE
    WHEN v_feed.feed_token IS NULL THEN NULL
    ELSE substr(encode(digest(v_feed.feed_token, 'sha256'), 'hex'), 1, 16)
  END;
  v_new_fingerprint := substr(encode(digest(v_new_token, 'sha256'), 'hex'), 1, 16);

  UPDATE public.portal_feeds
  SET feed_token = v_new_token,
      token_rotated_at = v_rotated_at,
      updated_at = now()
  WHERE id = v_feed.id;

  INSERT INTO public.portal_feed_token_rotations (
    feed_id,
    organization_id,
    rotated_at,
    rotated_by,
    rotation_reason,
    old_token_fingerprint,
    new_token_fingerprint
  ) VALUES (
    v_feed.id,
    v_feed.organization_id,
    v_rotated_at,
    p_actor_id,
    COALESCE(NULLIF(trim(p_reason), ''), 'manual'),
    v_old_fingerprint,
    v_new_fingerprint
  );

  INSERT INTO public.audit_logs (
    organization_id,
    user_id,
    action,
    entity_type,
    entity_ids,
    details
  ) VALUES (
    v_feed.organization_id,
    COALESCE(p_actor_id, '00000000-0000-0000-0000-000000000000'::UUID),
    'portal_feed_token_rotated',
    'portal_feed',
    ARRAY[v_feed.id],
    jsonb_build_object(
      'reason', COALESCE(NULLIF(trim(p_reason), ''), 'manual'),
      'old_token_fingerprint', v_old_fingerprint,
      'new_token_fingerprint', v_new_fingerprint
    )
  );

  RETURN QUERY SELECT v_feed.id, v_new_token, v_rotated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_stale_portal_feed_tokens(
  p_max_age_days INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 100
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feed RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_feed IN
    SELECT pf.id
    FROM public.portal_feeds pf
    WHERE COALESCE(pf.token_rotated_at, pf.created_at) <= now() - make_interval(days => GREATEST(1, p_max_age_days))
    ORDER BY COALESCE(pf.token_rotated_at, pf.created_at) ASC
    LIMIT GREATEST(1, p_limit)
  LOOP
    PERFORM public.rotate_portal_feed_token(v_feed.id, 'scheduled_rotation', NULL);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rotate_portal_feed_token(UUID, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rotate_stale_portal_feed_tokens(INTEGER, INTEGER) TO service_role;


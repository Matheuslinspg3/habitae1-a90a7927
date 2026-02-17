CREATE OR REPLACE FUNCTION public.accept_organization_invite(p_invite_id uuid, p_user_id uuid, p_user_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite RECORD;
  v_current_org_id uuid;
  v_member_count integer;
BEGIN
  -- 1. Fetch and lock the invite
  SELECT * INTO v_invite
  FROM organization_invites
  WHERE id = p_invite_id
  FOR UPDATE;

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('error', 'Convite não encontrado', 'status', 404);
  END IF;

  IF v_invite.status != 'pending' THEN
    RETURN jsonb_build_object('error', 'Convite já utilizado', 'status', 400);
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'Convite expirado', 'status', 400);
  END IF;

  -- Check email match (if invite is email-specific)
  IF v_invite.email IS NOT NULL AND lower(v_invite.email) != lower(p_user_email) THEN
    RETURN jsonb_build_object('error', 'Este convite não pertence a este email', 'status', 403);
  END IF;

  -- 2. Get current org
  SELECT organization_id INTO v_current_org_id
  FROM profiles
  WHERE user_id = p_user_id;

  -- Already in this org? Just mark accepted.
  IF v_current_org_id = v_invite.organization_id THEN
    UPDATE organization_invites
    SET status = 'accepted', accepted_at = now()
    WHERE id = p_invite_id;

    RETURN jsonb_build_object('success', true, 'message', 'Você já pertence a esta organização');
  END IF;

  -- 3. Clean up old single-member org
  IF v_current_org_id IS NOT NULL AND v_current_org_id != v_invite.organization_id THEN
    SELECT count(*) INTO v_member_count
    FROM profiles
    WHERE organization_id = v_current_org_id;

    IF v_member_count = 1 THEN
      UPDATE organizations SET is_active = false WHERE id = v_current_org_id;
    END IF;
  END IF;

  -- 4. Update profile organization
  UPDATE profiles
  SET organization_id = v_invite.organization_id
  WHERE user_id = p_user_id;

  -- 5. Replace roles atomically (user_roles has no organization_id column)
  DELETE FROM user_roles WHERE user_id = p_user_id;
  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, v_invite.role);

  -- 6. Mark invite accepted
  UPDATE organization_invites
  SET status = 'accepted', accepted_at = now()
  WHERE id = p_invite_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;
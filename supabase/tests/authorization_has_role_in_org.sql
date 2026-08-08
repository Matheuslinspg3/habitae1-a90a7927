-- Authorization regression tests for org-scoped roles.
-- Proves a role in org A does not grant access to org B.

BEGIN;

DO $$
DECLARE
  v_user_id uuid := '11111111-1111-1111-1111-111111111111';
  v_org_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_org_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_invite_b uuid;
BEGIN
  -- Seed minimal fixtures
  INSERT INTO auth.users (id, email)
  VALUES (v_user_id, 'rls-org-scope@example.com')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.organizations (id, name, created_by)
  VALUES
    (v_org_a, 'Org A (test)', v_user_id),
    (v_org_b, 'Org B (test)', v_user_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (user_id, organization_id, full_name)
  VALUES (v_user_id, v_org_a, 'RLS Test User')
  ON CONFLICT (user_id) DO UPDATE SET organization_id = excluded.organization_id;

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (v_user_id, v_org_a, 'leader')
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = excluded.role;

  -- has_role_in_org positive for org A, negative for org B
  IF NOT public.has_role_in_org(v_user_id, v_org_a, 'leader') THEN
    RAISE EXCEPTION 'expected leader role in org A';
  END IF;

  IF public.has_role_in_org(v_user_id, v_org_b, 'leader') THEN
    RAISE EXCEPTION 'role from org A leaked into org B';
  END IF;

  -- Switch execution context to authenticated user
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Seed invite in org B and assert RLS blocks access from org A session
  INSERT INTO public.platform_invites (organization_id, created_by, name, status)
  VALUES (v_org_b, v_user_id, 'Invite Org B', 'active')
  RETURNING id INTO v_invite_b;

  IF EXISTS (
    SELECT 1
    FROM public.platform_invites pi
    WHERE pi.id = v_invite_b
  ) THEN
    RAISE EXCEPTION 'RLS failure: user from org A can read platform_invites in org B';
  END IF;
END;
$$;

ROLLBACK;

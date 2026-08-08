-- SQL security tests for platform_invites tenant isolation
-- Run manually (ex.): psql "$SUPABASE_DB_URL" -f supabase/tests/platform_invites_rls.sql

BEGIN;

-- Stable test fixtures
DO $$
DECLARE
  v_org_a uuid := '00000000-0000-0000-0000-0000000000a1';
  v_org_b uuid := '00000000-0000-0000-0000-0000000000b2';
  v_user_a uuid := '10000000-0000-0000-0000-0000000000a1';
  v_user_b uuid := '20000000-0000-0000-0000-0000000000b2';
  v_invite_b uuid := '30000000-0000-0000-0000-0000000000b2';
  v_rows integer;
BEGIN
  -- cleanup (idempotent)
  DELETE FROM public.platform_invites WHERE id = v_invite_b;
  DELETE FROM public.user_roles WHERE user_id IN (v_user_a, v_user_b);
  DELETE FROM public.profiles WHERE user_id IN (v_user_a, v_user_b);
  DELETE FROM auth.users WHERE id IN (v_user_a, v_user_b);
  DELETE FROM public.organizations WHERE id IN (v_org_a, v_org_b);

  INSERT INTO public.organizations (id, name, type)
  VALUES
    (v_org_a, 'Test Org A', 'imobiliaria'),
    (v_org_b, 'Test Org B', 'imobiliaria');

  INSERT INTO auth.users (id, aud, role, email)
  VALUES
    (v_user_a, 'authenticated', 'authenticated', 'tenant-a@example.com'),
    (v_user_b, 'authenticated', 'authenticated', 'tenant-b@example.com');

  INSERT INTO public.profiles (user_id, organization_id, full_name)
  VALUES
    (v_user_a, v_org_a, 'Tenant A User'),
    (v_user_b, v_org_b, 'Tenant B User');

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES
    (v_user_a, v_org_a, 'platform_inviter'),
    (v_user_b, v_org_b, 'platform_inviter');

  INSERT INTO public.platform_invites (id, created_by, organization_id, name, status)
  VALUES (v_invite_b, v_user_b, v_org_b, 'Invite from org B', 'active');

  -- Simulate authenticated user from tenant A
  EXECUTE format('SET LOCAL ROLE authenticated');
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);

  UPDATE public.platform_invites
     SET status = 'cancelled'
   WHERE id = v_invite_b;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'RLS failure: tenant A was able to UPDATE tenant B invite';
  END IF;

  DELETE FROM public.platform_invites
   WHERE id = v_invite_b;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'RLS failure: tenant A was able to DELETE tenant B invite';
  END IF;

  RESET ROLE;
END;
$$;

ROLLBACK;

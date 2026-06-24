-- Minimize client-side pre-check surface: validate org code by invite id,
-- avoiding exposure of organization_id in the AcceptInvite page.
CREATE OR REPLACE FUNCTION public.validate_invite_org_code(p_invite_id uuid, p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_invites oi
    JOIN public.organizations o ON o.id = oi.organization_id
    WHERE oi.id = p_invite_id
      AND oi.status = 'pending'
      AND oi.expires_at > now()
      AND UPPER(o.invite_code) = UPPER(p_code)
  );
$$;

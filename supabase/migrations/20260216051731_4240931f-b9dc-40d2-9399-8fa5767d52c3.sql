
-- Create a function to get org name by invite ID (for the AcceptInvite page)
CREATE OR REPLACE FUNCTION public.get_org_name_for_invite(p_invite_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.name::text
  FROM organizations o
  JOIN organization_invites oi ON oi.organization_id = o.id
  WHERE oi.id = p_invite_id
  LIMIT 1;
$$;

-- Create a function to validate org code for an invite
CREATE OR REPLACE FUNCTION public.validate_invite_org_code(p_org_id uuid, p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations
    WHERE id = p_org_id
    AND UPPER(invite_code) = UPPER(p_code)
  );
$$;

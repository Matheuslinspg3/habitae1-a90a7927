
-- Create a secure function to get emails for team members in the same organization
CREATE OR REPLACE FUNCTION public.get_org_member_emails(org_id uuid)
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, u.email::text
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.organization_id = org_id
    AND org_id = get_user_organization_id();
$$;

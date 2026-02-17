-- Drop existing insert policy that only allows admins
DROP POLICY IF EXISTS "Admins can create invites" ON organization_invites;

-- Create new policy allowing leaders to create invites
CREATE POLICY "Leaders can insert invites"
ON organization_invites FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'leader') 
  AND organization_id = get_user_organization_id()
);
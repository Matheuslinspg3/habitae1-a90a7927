-- Harden SELECT access on organization_invites:
-- only organization members (admin/gestor context) or the invited authenticated email can read.
DROP POLICY IF EXISTS "Anyone can read pending invites" ON public.organization_invites;
DROP POLICY IF EXISTS "Anyone can read pending invites by id" ON public.organization_invites;
DROP POLICY IF EXISTS "Authenticated users can read pending invites" ON public.organization_invites;
DROP POLICY IF EXISTS "Users can view invites for their email" ON public.organization_invites;

CREATE POLICY "Org members or invited email can read invites"
ON public.organization_invites
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  OR lower(email) = lower(auth.email())
);

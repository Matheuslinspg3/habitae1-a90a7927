DROP POLICY "Leaders can insert invites" ON public.organization_invites;

CREATE POLICY "Admins and leaders can insert invites"
ON public.organization_invites
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'leader'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'developer'::app_role))
  AND (organization_id = get_user_organization_id())
);

CREATE POLICY "Admins can delete organization invites"
ON public.organization_invites
FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND (
    is_org_admin(auth.uid())
    OR has_role(auth.uid(), 'leader'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
  )
);

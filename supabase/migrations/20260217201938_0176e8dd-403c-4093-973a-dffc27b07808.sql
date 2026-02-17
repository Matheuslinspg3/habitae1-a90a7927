-- Allow org members to see roles of other org members
DROP POLICY IF EXISTS "Users view own or dev/leader see all" ON public.user_roles;

CREATE POLICY "Users view roles in same org"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'developer'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p1.organization_id = p2.organization_id
      WHERE p1.user_id = auth.uid()
        AND p2.user_id = user_roles.user_id
    )
  );
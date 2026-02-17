
-- Allow org admins to insert roles for members in their org
DROP POLICY IF EXISTS "Org admins can insert roles" ON public.user_roles;
CREATE POLICY "Org admins can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'developer'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR (
      has_role(auth.uid(), 'admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM profiles p1
        JOIN profiles p2 ON p1.organization_id = p2.organization_id
        WHERE p1.user_id = auth.uid()
          AND p2.user_id = user_roles.user_id
      )
    )
  );

-- Allow org admins to delete roles for members in their org
DROP POLICY IF EXISTS "Org admins can delete roles" ON public.user_roles;
CREATE POLICY "Org admins can delete roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'developer'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR (
      has_role(auth.uid(), 'admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM profiles p1
        JOIN profiles p2 ON p1.organization_id = p2.organization_id
        WHERE p1.user_id = auth.uid()
          AND p2.user_id = user_roles.user_id
      )
    )
  );

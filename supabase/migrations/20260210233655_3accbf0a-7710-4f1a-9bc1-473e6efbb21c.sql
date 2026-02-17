-- Allow leaders to also manage roles (currently only developers can)
DROP POLICY IF EXISTS "Developers can insert roles" ON user_roles;
CREATE POLICY "Dev or leader can insert roles" ON user_roles FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'developer'::app_role) OR has_role(auth.uid(), 'leader'::app_role));

DROP POLICY IF EXISTS "Developers can update roles" ON user_roles;
CREATE POLICY "Dev or leader can update roles" ON user_roles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'developer'::app_role) OR has_role(auth.uid(), 'leader'::app_role));

DROP POLICY IF EXISTS "Developers can delete roles" ON user_roles;
CREATE POLICY "Dev or leader can delete roles" ON user_roles FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'developer'::app_role) OR has_role(auth.uid(), 'leader'::app_role));

-- Allow leaders to also see all roles in their org
DROP POLICY IF EXISTS "Users can view own roles or developers see all" ON user_roles;
CREATE POLICY "Users view own or dev/leader see all" ON user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'developer'::app_role) OR has_role(auth.uid(), 'leader'::app_role));
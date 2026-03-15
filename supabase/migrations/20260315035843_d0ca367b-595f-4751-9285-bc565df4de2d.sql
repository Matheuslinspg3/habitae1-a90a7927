
DROP POLICY IF EXISTS "System admins can manage AI config" ON ai_provider_config;

CREATE POLICY "Admins and developers can read AI config"
ON ai_provider_config FOR SELECT TO authenticated
USING (
  is_system_admin()
  OR is_org_manager_or_above(auth.uid())
);

CREATE POLICY "Admins and developers can update AI config"
ON ai_provider_config FOR UPDATE TO authenticated
USING (
  is_system_admin()
  OR is_org_manager_or_above(auth.uid())
)
WITH CHECK (
  is_system_admin()
  OR is_org_manager_or_above(auth.uid())
);

CREATE POLICY "Admins and developers can insert AI config"
ON ai_provider_config FOR INSERT TO authenticated
WITH CHECK (
  is_system_admin()
  OR is_org_manager_or_above(auth.uid())
);

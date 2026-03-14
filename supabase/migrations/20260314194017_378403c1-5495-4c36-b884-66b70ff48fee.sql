
-- SQL 1: Corrigir ai_usage_logs INSERT
DROP POLICY IF EXISTS "Authenticated users can insert ai_usage_logs" ON ai_usage_logs;

CREATE POLICY "Users can insert own ai_usage_logs"
ON ai_usage_logs FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (organization_id IS NULL OR organization_id = get_user_organization_id())
);

-- SQL 2: Corrigir verification_codes INSERT
DROP POLICY IF EXISTS "Users can create verification codes" ON verification_codes;

CREATE POLICY "Authenticated users can create verification codes"
ON verification_codes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- SQL 3: Restringir imobzi_api_keys a gestores
DROP POLICY IF EXISTS "Org members can view API keys" ON imobzi_api_keys;
CREATE POLICY "Managers can view API keys"
ON imobzi_api_keys FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND is_org_manager_or_above(auth.uid())
);

DROP POLICY IF EXISTS "Org members can insert API keys" ON imobzi_api_keys;
CREATE POLICY "Managers can insert API keys"
ON imobzi_api_keys FOR INSERT TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id()
  AND is_org_manager_or_above(auth.uid())
);

DROP POLICY IF EXISTS "Org members can delete API keys" ON imobzi_api_keys;
CREATE POLICY "Managers can delete API keys"
ON imobzi_api_keys FOR DELETE TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND is_org_manager_or_above(auth.uid())
);

-- SQL 4: Role check no DELETE de properties
DROP POLICY IF EXISTS "Users can delete properties in their organization" ON properties;
CREATE POLICY "Managers can delete properties"
ON properties FOR DELETE TO authenticated
USING (
  is_member_of_org(organization_id)
  AND is_org_manager_or_above(auth.uid())
);

-- SQL 5: Proteger profile UPDATE
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update own profile (safe fields only)"
ON profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND organization_id IS NOT DISTINCT FROM (
    SELECT p.organization_id FROM profiles p WHERE p.user_id = auth.uid()
  )
);

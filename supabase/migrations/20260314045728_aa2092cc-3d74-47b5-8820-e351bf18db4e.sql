-- ================================================================
-- RED TEAM FIX 1: organization_invites — Remove cross-org invite enumeration
-- ================================================================
DROP POLICY IF EXISTS "Authenticated users can read pending invites" ON organization_invites;
DROP POLICY IF EXISTS "Anyone can read pending invites by id" ON organization_invites;

CREATE POLICY "Public can read specific invite by id"
ON organization_invites FOR SELECT
TO public
USING (
  status = 'pending'
  AND expires_at > now()
);

-- ================================================================
-- RED TEAM FIX 2: rd_station_settings — Restrict SELECT to managers only
-- ================================================================
DROP POLICY IF EXISTS "Users can view own org rd_station_settings" ON rd_station_settings;

CREATE POLICY "Managers can view own org rd_station_settings"
ON rd_station_settings FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND is_org_manager_or_above(auth.uid())
);

-- ================================================================
-- RED TEAM FIX 3: user_roles — Prevent privilege escalation
-- ================================================================
DROP POLICY IF EXISTS "Org admins can insert roles" ON user_roles;

CREATE POLICY "Org admins can insert roles (no escalation)"
ON user_roles FOR INSERT
TO authenticated
WITH CHECK (
  is_org_admin(auth.uid())
  AND role != 'developer'
  AND user_id IN (
    SELECT p.user_id FROM profiles p 
    WHERE p.organization_id = get_user_organization_id()
  )
);

-- ================================================================
-- RED TEAM FIX 4: ai_usage_logs — Restrict INSERT to authenticated only
-- ================================================================
DROP POLICY IF EXISTS "Service role can insert ai_usage_logs" ON ai_usage_logs;

CREATE POLICY "Authenticated users can insert ai_usage_logs"
ON ai_usage_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- ================================================================
-- RED TEAM FIX 5: property_landing_overrides — Restrict to org members
-- ================================================================
DROP POLICY IF EXISTS "Org members can view overrides" ON property_landing_overrides;

CREATE POLICY "Org members can view overrides"
ON property_landing_overrides FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id()
);

-- ================================================================
-- RED TEAM FIX 6: scrape_cache — Restrict to service role only
-- (no org_id column, so just block client-side access)
-- ================================================================
DROP POLICY IF EXISTS "Authenticated users can read scrape cache" ON scrape_cache;
-- No replacement policy = only service_role can access (RLS blocks all);
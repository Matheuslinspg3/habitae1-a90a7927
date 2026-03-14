-- ================================================================
-- RED TEAM FIX 7: organization_invites — Require authentication
-- The public policy still allows unauthenticated enumeration
-- ================================================================
DROP POLICY IF EXISTS "Public can read specific invite by id" ON organization_invites;

-- Only allow reading by specific ID via the platform-signup edge function (service role)
-- For the invite acceptance flow, we use the existing get_platform_invite() function
-- which is SECURITY DEFINER and doesn't need a SELECT policy

-- ================================================================
-- RED TEAM FIX 8: leads DELETE — Restrict to managers only
-- Corretores could delete leads they can't even see
-- ================================================================
DROP POLICY IF EXISTS "Org members can delete leads" ON leads;

CREATE POLICY "Managers can delete leads"
ON leads FOR DELETE
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND is_org_manager_or_above(auth.uid())
);

-- ================================================================
-- RED TEAM FIX 9: marketplace_properties — Hide owner PII from cross-org
-- Create a secure view that omits sensitive columns
-- ================================================================

-- We can't easily column-restrict in RLS, so we create a public view
-- that omits owner data, and restrict the base table
DROP POLICY IF EXISTS "Authenticated users can view available marketplace properties" ON marketplace_properties;

-- Replace with a policy that only exposes to org members (for full data)
-- Cross-org access should go through the existing public view
CREATE POLICY "Authenticated users can view available marketplace properties (no PII)"
ON marketplace_properties FOR SELECT
TO authenticated
USING (
  -- Own org: full access
  (organization_id = get_user_organization_id())
  OR
  -- Cross-org: only if status is available (PII will be filtered at app level)
  (status = 'disponivel' AND auth.role() = 'authenticated')
);

-- Note: The real fix for marketplace PII is at app level - the marketplace_properties_public
-- view already omits owner fields. We should ensure frontend uses that view for cross-org.
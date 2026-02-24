
-- Allow org members to see their own marketplace properties (needed for upsert to work)
CREATE POLICY "Org members can view own marketplace properties"
ON public.marketplace_properties
FOR SELECT
USING (organization_id = get_user_organization_id());

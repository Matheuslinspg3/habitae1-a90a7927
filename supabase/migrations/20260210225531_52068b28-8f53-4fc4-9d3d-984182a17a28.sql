
-- Fix: Allow org members to delete properties (not just admins)
DROP POLICY IF EXISTS "Admins can delete properties" ON public.properties;
CREATE POLICY "Users can delete properties in their organization"
  ON public.properties FOR DELETE
  USING (is_member_of_org(organization_id));

-- Add missing DELETE policies for dependent tables

-- property_visibility
CREATE POLICY "Users can delete property visibility in their org"
  ON public.property_visibility FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_visibility.property_id
    AND is_member_of_org(p.organization_id)
  ));

-- property_landing_content
CREATE POLICY "Users can delete property landing content in their org"
  ON public.property_landing_content FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_landing_content.property_id
    AND is_member_of_org(p.organization_id)
  ));

-- import_run_items (allow delete for org members via run)
CREATE POLICY "Users can delete import run items in their org"
  ON public.import_run_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM import_runs r
    WHERE r.id = import_run_items.run_id
    AND is_member_of_org(r.organization_id)
  ));

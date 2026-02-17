
-- Function to seed default lead types for an organization if none exist
CREATE OR REPLACE FUNCTION public.seed_org_lead_types(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only seed if the org has no lead types yet
  IF NOT EXISTS (SELECT 1 FROM lead_types WHERE organization_id = p_org_id) THEN
    INSERT INTO lead_types (name, color, is_default, organization_id)
    SELECT name, color, false, p_org_id
    FROM lead_types
    WHERE is_default = true AND organization_id IS NULL;
  END IF;
END;
$$;

-- Update RLS: allow edit/delete for all org-owned types (remove is_default restriction)
DROP POLICY IF EXISTS "Users can delete their org lead types" ON lead_types;
CREATE POLICY "Users can delete their org lead types"
  ON lead_types FOR DELETE
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update their org lead types" ON lead_types;
CREATE POLICY "Users can update their org lead types"
  ON lead_types FOR UPDATE
  USING (organization_id = get_user_organization_id());

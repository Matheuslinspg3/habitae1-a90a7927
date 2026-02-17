
-- Fix: seed templates even if org already has custom types
-- Check against template names specifically, not just any lead type
CREATE OR REPLACE FUNCTION public.seed_org_lead_types(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert global templates that don't already exist for this org (by name)
  INSERT INTO lead_types (name, color, is_default, organization_id)
  SELECT t.name, t.color, false, p_org_id
  FROM lead_types t
  WHERE t.is_default = true AND t.organization_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM lead_types o
      WHERE o.organization_id = p_org_id AND o.name = t.name
    );
END;
$$;

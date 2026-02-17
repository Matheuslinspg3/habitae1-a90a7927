
-- Add flag to track if org was already seeded with lead types
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS lead_types_seeded boolean NOT NULL DEFAULT false;

-- Update seed function to check the flag instead of checking types by name
CREATE OR REPLACE FUNCTION public.seed_org_lead_types(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only seed if the org hasn't been seeded yet
  IF NOT (SELECT lead_types_seeded FROM organizations WHERE id = p_org_id) THEN
    INSERT INTO lead_types (name, color, is_default, organization_id)
    SELECT name, color, false, p_org_id
    FROM lead_types
    WHERE is_default = true AND organization_id IS NULL;

    UPDATE organizations SET lead_types_seeded = true WHERE id = p_org_id;
  END IF;
END;
$$;

-- Mark existing orgs that already have lead types as seeded
UPDATE organizations SET lead_types_seeded = true
WHERE id IN (SELECT DISTINCT organization_id FROM lead_types WHERE organization_id IS NOT NULL);

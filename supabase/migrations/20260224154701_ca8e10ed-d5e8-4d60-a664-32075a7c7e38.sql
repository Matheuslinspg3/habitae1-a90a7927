
-- Drop the global unique constraint and replace with per-organization unique
ALTER TABLE public.properties DROP CONSTRAINT properties_property_code_key;

-- Add unique constraint scoped to organization
ALTER TABLE public.properties ADD CONSTRAINT properties_org_property_code_key UNIQUE (organization_id, property_code);

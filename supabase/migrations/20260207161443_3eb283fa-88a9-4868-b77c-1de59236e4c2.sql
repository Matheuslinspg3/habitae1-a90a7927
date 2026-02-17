
-- Add organization_id to marketplace_properties
ALTER TABLE public.marketplace_properties 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Populate existing records from properties table
UPDATE public.marketplace_properties mp
SET organization_id = p.organization_id
FROM public.properties p
WHERE mp.external_code = p.property_code
  AND mp.organization_id IS NULL;

-- Create index for performance
CREATE INDEX idx_marketplace_properties_organization_id 
ON public.marketplace_properties(organization_id);


-- Add "Futuro" default lead type
INSERT INTO public.lead_types (name, color, is_default, organization_id)
VALUES ('Futuro', '#14b8a6', true, NULL)
ON CONFLICT DO NOTHING;

-- Add interested_property_type_ids array column to leads for multi-select
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS interested_property_type_ids text[] DEFAULT '{}';

-- Migrate existing single values to the new array column
UPDATE public.leads
SET interested_property_type_ids = ARRAY[interested_property_type_id]
WHERE interested_property_type_id IS NOT NULL
  AND (interested_property_type_ids IS NULL OR interested_property_type_ids = '{}');

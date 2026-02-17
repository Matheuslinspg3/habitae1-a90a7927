
-- Add position column to lead_types for ordering
ALTER TABLE public.lead_types ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

-- Backfill positions based on current name order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY name) - 1 AS pos
  FROM public.lead_types
)
UPDATE public.lead_types SET position = ordered.pos FROM ordered WHERE lead_types.id = ordered.id;

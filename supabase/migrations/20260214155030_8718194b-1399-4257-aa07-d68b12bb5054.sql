
-- Add position column for lead ordering within stages
ALTER TABLE public.leads ADD COLUMN position integer NOT NULL DEFAULT 0;

-- Set initial positions based on created_at order within each stage
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY stage ORDER BY created_at ASC) AS rn
  FROM public.leads
)
UPDATE public.leads SET position = ranked.rn
FROM ranked WHERE public.leads.id = ranked.id;

-- Create index for efficient ordering
CREATE INDEX idx_leads_stage_position ON public.leads (organization_id, stage, position);

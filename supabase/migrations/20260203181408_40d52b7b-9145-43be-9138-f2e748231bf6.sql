-- Add column to store pending property IDs for batch processing
ALTER TABLE public.import_runs 
ADD COLUMN IF NOT EXISTS pending_property_ids text[] DEFAULT NULL;

-- Add index for faster lookup
CREATE INDEX IF NOT EXISTS idx_import_runs_status ON public.import_runs(status);

COMMENT ON COLUMN public.import_runs.pending_property_ids IS 'Array of Imobzi property IDs pending processing for chunked imports';
-- Fix: add 'processing' to import_runs status check constraint
-- The edge function uses 'processing' but the constraint only allows 'running'
ALTER TABLE public.import_runs DROP CONSTRAINT IF EXISTS import_runs_status_check;
ALTER TABLE public.import_runs ADD CONSTRAINT import_runs_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'starting'::text, 'running'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]));

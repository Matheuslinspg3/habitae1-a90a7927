-- Drop the existing check constraint and recreate with 'starting' status included
ALTER TABLE public.import_runs DROP CONSTRAINT IF EXISTS import_runs_status_check;

ALTER TABLE public.import_runs ADD CONSTRAINT import_runs_status_check 
  CHECK (status IN ('pending', 'starting', 'running', 'completed', 'failed', 'cancelled'));

-- Atomic increment function to prevent race conditions on import_runs counters
CREATE OR REPLACE FUNCTION public.increment_import_run_progress(
  p_run_id UUID,
  p_imported INT DEFAULT 0,
  p_errors INT DEFAULT 0,
  p_images_processed INT DEFAULT 0
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE import_runs
  SET
    imported = COALESCE(imported, 0) + p_imported,
    errors = COALESCE(errors, 0) + p_errors,
    images_processed = COALESCE(images_processed, 0) + p_images_processed
  WHERE id = p_run_id;
$$;

-- Fix the current run's imported counter to match reality (884 complete items)
UPDATE import_runs 
SET imported = 884
WHERE id = '41664735-5408-40d4-9fa6-251699a20b32';

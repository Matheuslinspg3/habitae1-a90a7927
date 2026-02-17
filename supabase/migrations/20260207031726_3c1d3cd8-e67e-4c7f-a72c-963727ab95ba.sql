
-- Fix search_path security warning
CREATE OR REPLACE FUNCTION public.claim_import_chunk(p_run_id UUID, p_chunk_size INT)
RETURNS TEXT[] AS $$
DECLARE
  claimed TEXT[];
  all_ids TEXT[];
  remaining TEXT[];
BEGIN
  SELECT pending_property_ids INTO all_ids
  FROM public.import_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF all_ids IS NULL OR array_length(all_ids, 1) IS NULL THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  claimed := all_ids[1:LEAST(p_chunk_size, array_length(all_ids, 1))];
  
  IF array_length(all_ids, 1) <= p_chunk_size THEN
    remaining := NULL;
  ELSE
    remaining := all_ids[p_chunk_size + 1:];
  END IF;

  UPDATE public.import_runs
  SET pending_property_ids = remaining
  WHERE id = p_run_id;

  RETURN claimed;
END;
$$ LANGUAGE plpgsql SET search_path = public;

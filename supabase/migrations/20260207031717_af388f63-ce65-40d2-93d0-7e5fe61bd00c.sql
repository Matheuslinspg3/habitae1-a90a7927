
-- 1. Atomic claim function: pops N property IDs with row-level locking to prevent race conditions
CREATE OR REPLACE FUNCTION public.claim_import_chunk(p_run_id UUID, p_chunk_size INT)
RETURNS TEXT[] AS $$
DECLARE
  claimed TEXT[];
  all_ids TEXT[];
  remaining TEXT[];
BEGIN
  -- Lock the row to prevent concurrent reads
  SELECT pending_property_ids INTO all_ids
  FROM import_runs
  WHERE id = p_run_id
  FOR UPDATE;

  IF all_ids IS NULL OR array_length(all_ids, 1) IS NULL THEN
    RETURN ARRAY[]::TEXT[];
  END IF;

  -- Claim first N items
  claimed := all_ids[1:LEAST(p_chunk_size, array_length(all_ids, 1))];
  
  -- Calculate remaining
  IF array_length(all_ids, 1) <= p_chunk_size THEN
    remaining := NULL;
  ELSE
    remaining := all_ids[p_chunk_size + 1:];
  END IF;

  -- Update the run with remaining IDs
  UPDATE import_runs
  SET pending_property_ids = remaining
  WHERE id = p_run_id;

  RETURN claimed;
END;
$$ LANGUAGE plpgsql;

-- 2. Clean up duplicate properties within org 6eb2ec2c (the active org)
-- Keep only the latest entry per source_property_id
DELETE FROM properties
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY organization_id, source_provider, source_property_id
        ORDER BY created_at DESC
      ) as rn
    FROM properties
    WHERE source_provider = 'imobzi'
    AND organization_id = '6eb2ec2c-50da-42bd-a446-43464b43366e'
  ) ranked
  WHERE rn > 1
);

-- 3. Also clean duplicates for other orgs that may have them
DELETE FROM properties
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY organization_id, source_provider, source_property_id
        ORDER BY created_at DESC
      ) as rn
    FROM properties
    WHERE source_provider = 'imobzi'
  ) ranked
  WHERE rn > 1
);

-- 4. Fix the active run counters to match actual items
UPDATE import_runs
SET 
  imported = (SELECT COUNT(*) FROM import_run_items WHERE run_id = 'c8ab9881-07a3-40bd-a08f-b08028b91397' AND status = 'complete'),
  errors = (SELECT COUNT(*) FROM import_run_items WHERE run_id = 'c8ab9881-07a3-40bd-a08f-b08028b91397' AND status = 'error')
WHERE id = 'c8ab9881-07a3-40bd-a08f-b08028b91397';

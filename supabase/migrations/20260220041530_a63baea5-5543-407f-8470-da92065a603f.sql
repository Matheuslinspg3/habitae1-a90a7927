
CREATE OR REPLACE FUNCTION public.auto_generate_property_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_next INT;
  v_attempts INT := 0;
BEGIN
  IF NEW.property_code IS NULL THEN
    LOOP
      SELECT COALESCE(MAX(property_code::int), 0) + 1 + v_attempts
      INTO v_next
      FROM properties
      WHERE organization_id = NEW.organization_id
        AND property_code ~ '^\d+$';

      v_next := COALESCE(v_next, 1);

      -- Check if this code already exists
      IF NOT EXISTS (
        SELECT 1 FROM properties
        WHERE organization_id = NEW.organization_id
          AND property_code = v_next::text
      ) THEN
        NEW.property_code := v_next::text;
        EXIT;
      END IF;

      v_attempts := v_attempts + 1;
      IF v_attempts > 50 THEN
        -- Fallback: use timestamp-based code
        NEW.property_code := (EXTRACT(EPOCH FROM now())::bigint % 99999 + 10000)::text;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

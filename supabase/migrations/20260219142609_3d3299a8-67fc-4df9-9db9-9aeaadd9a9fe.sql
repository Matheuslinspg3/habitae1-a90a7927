
-- 1. Trigger cascata para prevenir órfãos no marketplace
CREATE OR REPLACE FUNCTION cascade_delete_marketplace()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM marketplace_contact_access WHERE marketplace_property_id = OLD.id;
  DELETE FROM marketplace_properties WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_cascade_marketplace_delete ON properties;
CREATE TRIGGER trigger_cascade_marketplace_delete
  BEFORE DELETE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION cascade_delete_marketplace();

-- 2. Redefinir property_code como sequencial por org
CREATE OR REPLACE FUNCTION auto_generate_property_code()
RETURNS TRIGGER AS $$
DECLARE
  v_next INT;
BEGIN
  IF NEW.property_code IS NULL THEN
    SELECT COALESCE(MAX(property_code::int), 0) + 1
    INTO v_next
    FROM properties
    WHERE organization_id = NEW.organization_id
      AND property_code ~ '^\d+$';
    NEW.property_code := COALESCE(v_next, 1)::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recalcular códigos existentes como sequenciais
WITH ranked AS (
  SELECT id, organization_id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id ORDER BY created_at
    ) as seq
  FROM properties
)
UPDATE properties p
SET property_code = r.seq::text
FROM ranked r
WHERE p.id = r.id;

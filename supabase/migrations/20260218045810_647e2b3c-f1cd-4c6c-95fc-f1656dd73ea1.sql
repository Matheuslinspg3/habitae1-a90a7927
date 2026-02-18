
-- Trigger: log when a lead is updated
CREATE OR REPLACE FUNCTION public.log_lead_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only log meaningful changes (not just position reordering)
  IF OLD.name IS DISTINCT FROM NEW.name
    OR OLD.email IS DISTINCT FROM NEW.email
    OR OLD.phone IS DISTINCT FROM NEW.phone
    OR OLD.broker_id IS DISTINCT FROM NEW.broker_id
    OR OLD.lead_stage_id IS DISTINCT FROM NEW.lead_stage_id
    OR OLD.lead_type_id IS DISTINCT FROM NEW.lead_type_id
    OR OLD.temperature IS DISTINCT FROM NEW.temperature
    OR OLD.estimated_value IS DISTINCT FROM NEW.estimated_value
    OR OLD.notes IS DISTINCT FROM NEW.notes
    OR OLD.source IS DISTINCT FROM NEW.source
    OR OLD.is_active IS DISTINCT FROM NEW.is_active
  THEN
    INSERT INTO public.activity_log (organization_id, user_id, action_type, entity_type, entity_id, entity_name, metadata)
    VALUES (
      NEW.organization_id,
      COALESCE(auth.uid(), NEW.created_by),
      CASE
        WHEN OLD.lead_stage_id IS DISTINCT FROM NEW.lead_stage_id THEN 'stage_changed'
        WHEN OLD.broker_id IS DISTINCT FROM NEW.broker_id THEN 'assigned'
        WHEN OLD.is_active = true AND NEW.is_active = false THEN 'deleted'
        ELSE 'updated'
      END,
      'lead',
      NEW.id::text,
      NEW.name,
      jsonb_build_object(
        'changed_fields', (
          SELECT jsonb_object_agg(field, true) FROM (
            SELECT unnest(ARRAY[
              CASE WHEN OLD.name IS DISTINCT FROM NEW.name THEN 'name' END,
              CASE WHEN OLD.email IS DISTINCT FROM NEW.email THEN 'email' END,
              CASE WHEN OLD.phone IS DISTINCT FROM NEW.phone THEN 'phone' END,
              CASE WHEN OLD.broker_id IS DISTINCT FROM NEW.broker_id THEN 'broker_id' END,
              CASE WHEN OLD.lead_stage_id IS DISTINCT FROM NEW.lead_stage_id THEN 'lead_stage_id' END,
              CASE WHEN OLD.temperature IS DISTINCT FROM NEW.temperature THEN 'temperature' END,
              CASE WHEN OLD.estimated_value IS DISTINCT FROM NEW.estimated_value THEN 'estimated_value' END,
              CASE WHEN OLD.notes IS DISTINCT FROM NEW.notes THEN 'notes' END
            ]) AS field
          ) sub WHERE field IS NOT NULL
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_lead_updated ON public.leads;
CREATE TRIGGER trg_log_lead_updated
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.log_lead_updated();

-- Trigger: log when a property is updated
CREATE OR REPLACE FUNCTION public.log_property_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.title IS DISTINCT FROM NEW.title
    OR OLD.status IS DISTINCT FROM NEW.status
    OR OLD.sale_price IS DISTINCT FROM NEW.sale_price
    OR OLD.rent_price IS DISTINCT FROM NEW.rent_price
    OR OLD.transaction_type IS DISTINCT FROM NEW.transaction_type
    OR OLD.description IS DISTINCT FROM NEW.description
    OR OLD.bedrooms IS DISTINCT FROM NEW.bedrooms
    OR OLD.bathrooms IS DISTINCT FROM NEW.bathrooms
    OR OLD.address_city IS DISTINCT FROM NEW.address_city
    OR OLD.address_neighborhood IS DISTINCT FROM NEW.address_neighborhood
    OR OLD.property_type_id IS DISTINCT FROM NEW.property_type_id
  THEN
    INSERT INTO public.activity_log (organization_id, user_id, action_type, entity_type, entity_id, entity_name, metadata)
    VALUES (
      NEW.organization_id,
      COALESCE(auth.uid(), NEW.created_by),
      'updated',
      'property',
      NEW.id::text,
      COALESCE(NEW.title, ''),
      jsonb_build_object(
        'changed_fields', (
          SELECT jsonb_object_agg(field, true) FROM (
            SELECT unnest(ARRAY[
              CASE WHEN OLD.title IS DISTINCT FROM NEW.title THEN 'title' END,
              CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status' END,
              CASE WHEN OLD.sale_price IS DISTINCT FROM NEW.sale_price THEN 'sale_price' END,
              CASE WHEN OLD.rent_price IS DISTINCT FROM NEW.rent_price THEN 'rent_price' END,
              CASE WHEN OLD.description IS DISTINCT FROM NEW.description THEN 'description' END,
              CASE WHEN OLD.address_city IS DISTINCT FROM NEW.address_city THEN 'address_city' END
            ]) AS field
          ) sub WHERE field IS NOT NULL
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_property_updated ON public.properties;
CREATE TRIGGER trg_log_property_updated
AFTER UPDATE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.log_property_updated();

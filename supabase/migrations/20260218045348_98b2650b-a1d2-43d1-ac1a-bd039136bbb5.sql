
-- Trigger to log lead_interactions into activity_log
CREATE OR REPLACE FUNCTION public.log_lead_interaction_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_lead_name TEXT;
  v_org_id UUID;
  v_type_label TEXT;
BEGIN
  -- Get lead info
  SELECT l.name, l.organization_id INTO v_lead_name, v_org_id
  FROM leads l WHERE l.id = NEW.lead_id;

  IF v_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Map type to label
  v_type_label := CASE NEW.type
    WHEN 'ligacao' THEN 'Ligação'
    WHEN 'email' THEN 'E-mail'
    WHEN 'visita' THEN 'Visita'
    WHEN 'whatsapp' THEN 'WhatsApp'
    WHEN 'reuniao' THEN 'Reunião'
    WHEN 'nota' THEN 'Nota'
    ELSE NEW.type::text
  END;

  INSERT INTO public.activity_log (organization_id, user_id, action_type, entity_type, entity_id, entity_name, metadata)
  VALUES (
    v_org_id,
    NEW.created_by,
    'interaction',
    'lead',
    NEW.lead_id::text,
    v_lead_name,
    jsonb_build_object('interaction_type', NEW.type, 'interaction_label', v_type_label, 'interaction_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_lead_interaction
AFTER INSERT ON public.lead_interactions
FOR EACH ROW
EXECUTE FUNCTION public.log_lead_interaction_activity();

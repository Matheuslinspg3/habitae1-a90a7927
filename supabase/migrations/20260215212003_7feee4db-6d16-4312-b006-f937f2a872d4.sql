CREATE OR REPLACE FUNCTION public.log_activity_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_name TEXT;
  v_action TEXT;
  v_entity_type TEXT;
BEGIN
  v_entity_type := TG_ARGV[0];
  v_action := TG_ARGV[1];
  
  IF v_entity_type = 'lead' THEN
    v_entity_name := NEW.name;
  ELSIF v_entity_type = 'property' THEN
    v_entity_name := NEW.title;
  ELSIF v_entity_type = 'task' THEN
    v_entity_name := NEW.title;
  ELSIF v_entity_type = 'contract' THEN
    v_entity_name := NEW.code;
  ELSIF v_entity_type = 'appointment' THEN
    v_entity_name := NEW.title;
  ELSE
    v_entity_name := '';
  END IF;

  INSERT INTO public.activity_log (organization_id, user_id, action_type, entity_type, entity_id, entity_name)
  VALUES (NEW.organization_id, COALESCE(NEW.created_by, auth.uid()), v_action, v_entity_type, NEW.id::text, v_entity_name);
  
  RETURN NEW;
END;
$$;
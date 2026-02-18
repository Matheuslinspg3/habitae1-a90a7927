
-- Trigger 1: Notify admins/sub-admins when a new lead arrives without broker assignment
CREATE OR REPLACE FUNCTION public.notify_unassigned_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_manager RECORD;
BEGIN
  -- Only fire when lead is created without a broker
  IF NEW.broker_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Notify all admins and sub_admins in the same organization
  FOR v_manager IN
    SELECT ur.user_id
    FROM user_roles ur
    JOIN profiles p ON p.user_id = ur.user_id AND p.organization_id = NEW.organization_id
    WHERE ur.role IN ('admin', 'sub_admin')
  LOOP
    INSERT INTO notifications (user_id, organization_id, type, title, message, entity_id, entity_type)
    VALUES (
      v_manager.user_id,
      NEW.organization_id,
      'lead_unassigned',
      'Novo lead sem corretor',
      'O lead "' || NEW.name || '" chegou sem corretor designado. Atribua-o a um corretor.',
      NEW.id,
      'lead'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_unassigned_lead
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.notify_unassigned_lead();

-- Trigger 2: Alert admins when a broker accumulates more than 5 leads without a defined stage (first stage = unclassified)
CREATE OR REPLACE FUNCTION public.notify_broker_lead_overload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_unclassified_count INT;
  v_first_stage_id UUID;
  v_broker_name TEXT;
  v_manager RECORD;
BEGIN
  -- Only fire when a broker is assigned
  IF NEW.broker_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the first (default/lowest position) stage for this org
  SELECT id INTO v_first_stage_id
  FROM lead_stages
  WHERE (organization_id = NEW.organization_id OR (organization_id IS NULL AND is_default = true))
  ORDER BY position ASC
  LIMIT 1;

  -- Count unclassified leads for this broker: leads in first stage or with NULL stage
  SELECT COUNT(*) INTO v_unclassified_count
  FROM leads
  WHERE broker_id = NEW.broker_id
    AND organization_id = NEW.organization_id
    AND is_active = true
    AND (lead_stage_id IS NULL OR lead_stage_id = v_first_stage_id);

  -- Only alert if threshold exceeded
  IF v_unclassified_count > 5 THEN
    -- Get broker name
    SELECT full_name INTO v_broker_name
    FROM profiles
    WHERE user_id = NEW.broker_id
    LIMIT 1;

    -- Notify admins/sub-admins
    FOR v_manager IN
      SELECT ur.user_id
      FROM user_roles ur
      JOIN profiles p ON p.user_id = ur.user_id AND p.organization_id = NEW.organization_id
      WHERE ur.role IN ('admin', 'sub_admin')
    LOOP
      -- Avoid duplicate notifications: only insert if no similar unread notification exists in last 24h
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = v_manager.user_id
          AND type = 'broker_overload'
          AND entity_id = NEW.broker_id
          AND read = false
          AND created_at > NOW() - INTERVAL '24 hours'
      ) THEN
        INSERT INTO notifications (user_id, organization_id, type, title, message, entity_id, entity_type)
        VALUES (
          v_manager.user_id,
          NEW.organization_id,
          'broker_overload',
          'Corretor com acúmulo de leads',
          'O corretor "' || COALESCE(v_broker_name, 'Desconhecido') || '" possui ' || v_unclassified_count || ' leads sem classificação. Verifique a distribuição.',
          NEW.broker_id,
          'broker'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_broker_overload
AFTER INSERT OR UPDATE OF broker_id, lead_stage_id ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.notify_broker_lead_overload();

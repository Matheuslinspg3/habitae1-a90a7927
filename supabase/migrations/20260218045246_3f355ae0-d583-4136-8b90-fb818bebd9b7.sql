
-- Create a helper function to insert notifications bypassing RLS (for use by triggers only)
CREATE OR REPLACE FUNCTION public.insert_notification(
  p_user_id UUID,
  p_organization_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO notifications (user_id, organization_id, type, title, message, entity_id, entity_type)
  VALUES (p_user_id, p_organization_id, p_type, p_title, p_message, p_entity_id, p_entity_type);
END;
$$;

-- Recreate trigger 1: notify admins when unassigned lead arrives
CREATE OR REPLACE FUNCTION public.notify_unassigned_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_manager RECORD;
BEGIN
  IF NEW.broker_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR v_manager IN
    SELECT ur.user_id
    FROM user_roles ur
    JOIN profiles p ON p.user_id = ur.user_id AND p.organization_id = NEW.organization_id
    WHERE ur.role IN ('admin', 'sub_admin')
  LOOP
    PERFORM insert_notification(
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

-- Recreate trigger 2: notify admins on broker overload + notify broker on assignment
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
  v_lead_name TEXT;
BEGIN
  IF NEW.broker_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Notify the broker that a lead was assigned to them
  IF (TG_OP = 'INSERT' AND NEW.broker_id IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND (OLD.broker_id IS DISTINCT FROM NEW.broker_id) AND NEW.broker_id IS NOT NULL) THEN
    
    v_lead_name := NEW.name;
    PERFORM insert_notification(
      NEW.broker_id,
      NEW.organization_id,
      'lead_assigned',
      'Novo lead atribuído',
      'O lead "' || v_lead_name || '" foi atribuído a você.',
      NEW.id,
      'lead'
    );
  END IF;

  -- Check overload
  SELECT id INTO v_first_stage_id
  FROM lead_stages
  WHERE (organization_id = NEW.organization_id OR (organization_id IS NULL AND is_default = true))
  ORDER BY position ASC
  LIMIT 1;

  SELECT COUNT(*) INTO v_unclassified_count
  FROM leads
  WHERE broker_id = NEW.broker_id
    AND organization_id = NEW.organization_id
    AND is_active = true
    AND (lead_stage_id IS NULL OR lead_stage_id = v_first_stage_id);

  IF v_unclassified_count > 5 THEN
    SELECT full_name INTO v_broker_name
    FROM profiles
    WHERE user_id = NEW.broker_id
    LIMIT 1;

    FOR v_manager IN
      SELECT ur.user_id
      FROM user_roles ur
      JOIN profiles p ON p.user_id = ur.user_id AND p.organization_id = NEW.organization_id
      WHERE ur.role IN ('admin', 'sub_admin')
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = v_manager.user_id
          AND type = 'broker_overload'
          AND entity_id = NEW.broker_id
          AND read = false
          AND created_at > NOW() - INTERVAL '24 hours'
      ) THEN
        PERFORM insert_notification(
          v_manager.user_id,
          NEW.organization_id,
          'broker_overload',
          'Corretor com acúmulo de leads',
          'O corretor "' || COALESCE(v_broker_name, 'Desconhecido') || '" possui ' || v_unclassified_count || ' leads sem classificação.',
          NEW.broker_id,
          'broker'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

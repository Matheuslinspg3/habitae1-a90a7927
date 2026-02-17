
-- Bloco 1: Fix subscription plans
UPDATE public.subscription_plans 
SET name = 'Professional', price_monthly = 100.00, price_yearly = 1000.00
WHERE slug = 'pro';

UPDATE public.subscription_plans SET is_active = false WHERE slug IN ('starter', 'enterprise');

-- Bloco 5: Add sub_admin role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sub_admin';

-- Bloco 3: Create activity_log table
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_org ON public.activity_log(organization_id, created_at DESC);
CREATE INDEX idx_activity_log_user ON public.activity_log(user_id, created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org activities"
ON public.activity_log FOR SELECT
TO authenticated
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Members can insert org activities"
ON public.activity_log FOR INSERT
TO authenticated
WITH CHECK (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

-- Auto-log triggers for leads, properties, tasks
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
  
  v_entity_name := CASE v_entity_type
    WHEN 'lead' THEN NEW.name
    WHEN 'property' THEN NEW.title
    WHEN 'task' THEN NEW.title
    WHEN 'contract' THEN NEW.code
    WHEN 'appointment' THEN NEW.title
    ELSE ''
  END;

  INSERT INTO public.activity_log (organization_id, user_id, action_type, entity_type, entity_id, entity_name)
  VALUES (NEW.organization_id, COALESCE(NEW.created_by, auth.uid()), v_action, v_entity_type, NEW.id::text, v_entity_name);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_lead_created AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.log_activity_on_insert('lead', 'created');

CREATE TRIGGER log_property_created AFTER INSERT ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.log_activity_on_insert('property', 'created');

CREATE TRIGGER log_task_created AFTER INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.log_activity_on_insert('task', 'created');

CREATE TRIGGER log_contract_created AFTER INSERT ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.log_activity_on_insert('contract', 'created');

CREATE TRIGGER log_appointment_created AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.log_activity_on_insert('appointment', 'created');

-- Task completed trigger
CREATE OR REPLACE FUNCTION public.log_task_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.completed = true AND (OLD.completed IS NULL OR OLD.completed = false) THEN
    INSERT INTO public.activity_log (organization_id, user_id, action_type, entity_type, entity_id, entity_name)
    VALUES (NEW.organization_id, auth.uid(), 'completed', 'task', NEW.id::text, NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_task_completed AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.log_task_completed();


-- Create visit_status enum
DO $$ BEGIN
  CREATE TYPE public.visit_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create property_visits table
CREATE TABLE IF NOT EXISTS public.property_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  property_id UUID NOT NULL REFERENCES public.properties(id),
  lead_id UUID NOT NULL REFERENCES public.leads(id),
  agent_id UUID NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  visit_status public.visit_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  feedback TEXT,
  rating SMALLINT CHECK (rating >= 1 AND rating <= 5),
  cancelled_reason TEXT,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.property_visits ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view visits in their org"
  ON public.property_visits FOR SELECT TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert visits in their org"
  ON public.property_visits FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update visits in their org"
  ON public.property_visits FOR UPDATE TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete visits in their org"
  ON public.property_visits FOR DELETE TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- updated_at trigger
CREATE TRIGGER set_updated_at_property_visits
  BEFORE UPDATE ON public.property_visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_support();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.property_visits;

-- Notification trigger for new visits
CREATE OR REPLACE FUNCTION public.notify_visit_scheduled()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_property_title TEXT;
  v_lead_name TEXT;
  v_scheduled TEXT;
BEGIN
  SELECT title INTO v_property_title FROM properties WHERE id = NEW.property_id;
  SELECT name INTO v_lead_name FROM leads WHERE id = NEW.lead_id;
  v_scheduled := to_char(NEW.scheduled_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');

  PERFORM insert_notification(
    NEW.agent_id,
    NEW.organization_id,
    'visit_scheduled',
    'Nova visita agendada',
    'Visita em "' || COALESCE(v_property_title, 'Imóvel') || '" com ' || COALESCE(v_lead_name, 'Lead') || ' em ' || v_scheduled,
    NEW.id,
    'visit'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_visit_scheduled
  AFTER INSERT ON public.property_visits
  FOR EACH ROW EXECUTE FUNCTION public.notify_visit_scheduled();

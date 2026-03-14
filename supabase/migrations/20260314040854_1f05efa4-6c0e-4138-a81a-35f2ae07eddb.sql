
-- Add score and ai_summary columns to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ai_summary_at TIMESTAMPTZ;

-- Create lead_score_events table
CREATE TABLE public.lead_score_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  score_delta INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_score_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org score events"
  ON public.lead_score_events FOR SELECT TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own org score events"
  ON public.lead_score_events FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_lead_score_events_lead ON public.lead_score_events(lead_id);
CREATE INDEX idx_lead_score_events_org ON public.lead_score_events(organization_id);
CREATE INDEX idx_lead_score_events_created ON public.lead_score_events(lead_id, created_at DESC);

-- Trigger to auto-recalculate score on leads when events are inserted
CREATE OR REPLACE FUNCTION public.recalculate_lead_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total INTEGER;
  v_temp TEXT;
BEGIN
  SELECT COALESCE(SUM(score_delta), 0) INTO v_total
  FROM lead_score_events WHERE lead_id = NEW.lead_id;

  -- Clamp to 0-100
  v_total := GREATEST(0, LEAST(100, v_total));

  -- Determine temperature from score
  IF v_total >= 70 THEN v_temp := 'quente';
  ELSIF v_total >= 40 THEN v_temp := 'morno';
  ELSE v_temp := 'frio';
  END IF;

  UPDATE leads SET score = v_total, temperature = v_temp, updated_at = now()
  WHERE id = NEW.lead_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalculate_lead_score
AFTER INSERT ON public.lead_score_events
FOR EACH ROW EXECUTE FUNCTION public.recalculate_lead_score();

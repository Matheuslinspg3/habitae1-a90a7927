
-- Create lead_stages table (customizable per org, like lead_types)
CREATE TABLE public.lead_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  position INTEGER NOT NULL DEFAULT 0,
  organization_id UUID REFERENCES public.organizations(id),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_win BOOLEAN NOT NULL DEFAULT false,
  is_loss BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_stages ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view stages for their org"
ON public.lead_stages FOR SELECT
USING (
  organization_id IS NULL
  OR organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert stages for their org"
ON public.lead_stages FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update stages for their org"
ON public.lead_stages FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete stages for their org"
ON public.lead_stages FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  )
);

-- Insert global template stages (organization_id IS NULL = templates)
INSERT INTO public.lead_stages (name, color, position, is_default, is_win, is_loss) VALUES
  ('Novos', '#64748b', 0, true, false, false),
  ('Em Contato', '#3b82f6', 1, true, false, false),
  ('Visita Agendada', '#eab308', 2, true, false, false),
  ('Proposta', '#f97316', 3, true, false, false),
  ('Negociação', '#a855f7', 4, true, false, false),
  ('Fechado Ganho', '#22c55e', 5, true, true, false),
  ('Fechado Perdido', '#ef4444', 6, true, false, true);

-- Add seeded flag to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS lead_stages_seeded BOOLEAN NOT NULL DEFAULT false;

-- Seed function: clones template stages into org on first access
CREATE OR REPLACE FUNCTION public.seed_org_lead_stages(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (SELECT lead_stages_seeded FROM organizations WHERE id = p_org_id) THEN
    INSERT INTO lead_stages (name, color, position, is_default, is_win, is_loss, organization_id)
    SELECT name, color, position, false, is_win, is_loss, p_org_id
    FROM lead_stages
    WHERE is_default = true AND organization_id IS NULL;

    UPDATE organizations SET lead_stages_seeded = true WHERE id = p_org_id;
  END IF;
END;
$$;

-- Add lead_stage_id column to leads
ALTER TABLE public.leads ADD COLUMN lead_stage_id UUID REFERENCES public.lead_stages(id);

-- Seed stages for all existing orgs
DO $$
DECLARE
  org_record RECORD;
BEGIN
  FOR org_record IN SELECT id FROM organizations LOOP
    PERFORM seed_org_lead_stages(org_record.id);
  END LOOP;
END;
$$;

-- Backfill existing leads with lead_stage_id based on enum → stage name mapping
UPDATE leads SET lead_stage_id = ls.id
FROM lead_stages ls
WHERE ls.organization_id = leads.organization_id
  AND ls.name = CASE leads.stage::text
    WHEN 'novo' THEN 'Novos'
    WHEN 'contato' THEN 'Em Contato'
    WHEN 'visita' THEN 'Visita Agendada'
    WHEN 'proposta' THEN 'Proposta'
    WHEN 'negociacao' THEN 'Negociação'
    WHEN 'fechado_ganho' THEN 'Fechado Ganho'
    WHEN 'fechado_perdido' THEN 'Fechado Perdido'
  END;

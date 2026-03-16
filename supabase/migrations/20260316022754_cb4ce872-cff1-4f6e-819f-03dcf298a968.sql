
-- Contract templates table
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  contract_type TEXT NOT NULL DEFAULT 'venda',
  body_html TEXT NOT NULL DEFAULT '',
  variables TEXT[] NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view templates of their org"
  ON public.contract_templates FOR SELECT TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert templates in their org"
  ON public.contract_templates FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update templates in their org"
  ON public.contract_templates FOR UPDATE TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete templates in their org"
  ON public.contract_templates FOR DELETE TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Index
CREATE INDEX idx_contract_templates_org ON public.contract_templates(organization_id);

-- Updated_at trigger
CREATE TRIGGER set_updated_at_contract_templates
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_support();

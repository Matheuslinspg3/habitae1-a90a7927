CREATE TABLE public.generated_arts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  url_feed text,
  url_story text,
  url_banner text,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_arts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org arts" ON public.generated_arts
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own org arts" ON public.generated_arts
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE user_id = auth.uid()) AND created_by = auth.uid());

CREATE INDEX idx_generated_arts_property ON public.generated_arts(property_id, created_at DESC);
CREATE INDEX idx_generated_arts_org ON public.generated_arts(organization_id, created_at DESC);

CREATE TABLE public.anuncios_gerados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  corretor_id UUID NOT NULL,
  texto_portal TEXT,
  texto_instagram TEXT,
  texto_whatsapp TEXT,
  dados_formulario JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.anuncios_gerados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own org anuncios"
  ON public.anuncios_gerados FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own org anuncios"
  ON public.anuncios_gerados FOR SELECT TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

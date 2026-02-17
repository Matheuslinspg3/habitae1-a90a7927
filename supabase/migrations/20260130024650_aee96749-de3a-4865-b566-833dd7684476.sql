-- Tabela para armazenar conteúdo gerado por IA para landing pages
CREATE TABLE public.property_landing_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  headline TEXT NOT NULL,
  subheadline TEXT,
  description_persuasive TEXT NOT NULL,
  key_features JSONB DEFAULT '[]',
  cta_primary TEXT NOT NULL,
  cta_secondary TEXT,
  seo_title TEXT,
  seo_description TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id)
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_property_landing_content_updated_at
  BEFORE UPDATE ON public.property_landing_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS para property_landing_content
ALTER TABLE public.property_landing_content ENABLE ROW LEVEL SECURITY;

-- Política: Qualquer pessoa pode ler (landing pages são públicas)
CREATE POLICY "Landing page content is publicly readable"
  ON public.property_landing_content
  FOR SELECT
  USING (true);

-- Política: Membros da organização podem inserir/atualizar
CREATE POLICY "Organization members can manage landing content"
  ON public.property_landing_content
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_landing_content.property_id
      AND is_member_of_org(p.organization_id)
    )
  );

-- Índices
CREATE INDEX idx_property_landing_content_property_id ON public.property_landing_content(property_id);
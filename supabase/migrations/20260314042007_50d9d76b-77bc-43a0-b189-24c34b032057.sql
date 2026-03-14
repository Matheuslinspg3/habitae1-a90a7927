
-- Document templates per organization
CREATE TABLE IF NOT EXISTS public.lead_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  operation_type text NOT NULL, -- compra_financiada, compra_vista, locacao, permuta
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_document_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.lead_document_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_required boolean NOT NULL DEFAULT true,
  max_size_mb integer NOT NULL DEFAULT 10,
  accepted_formats text[] NOT NULL DEFAULT ARRAY['pdf','jpg','jpeg','png'],
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  template_item_id uuid REFERENCES public.lead_document_template_items(id),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size_bytes bigint,
  mime_type text,
  status text NOT NULL DEFAULT 'pending', -- pending, received, approved, rejected
  rejection_reason text,
  uploaded_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  ai_validation jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.lead_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_document_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view templates" ON public.lead_document_templates
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage templates" ON public.lead_document_templates
  FOR ALL TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()) AND public.is_org_manager_or_above(auth.uid()));

CREATE POLICY "Org members can view template items" ON public.lead_document_template_items
  FOR SELECT TO authenticated
  USING (template_id IN (SELECT id FROM lead_document_templates WHERE organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Admins can manage template items" ON public.lead_document_template_items
  FOR ALL TO authenticated
  USING (template_id IN (SELECT id FROM lead_document_templates WHERE organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())))
  WITH CHECK (template_id IN (SELECT id FROM lead_document_templates WHERE organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())) AND public.is_org_manager_or_above(auth.uid()));

CREATE POLICY "Org members can view lead documents" ON public.lead_documents
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Org members can insert lead documents" ON public.lead_documents
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Org members can update lead documents" ON public.lead_documents
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can delete lead documents" ON public.lead_documents
  FOR DELETE TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()) AND public.is_org_manager_or_above(auth.uid()));

-- Indexes
CREATE INDEX idx_lead_documents_lead ON public.lead_documents(lead_id, created_at DESC);
CREATE INDEX idx_lead_document_templates_org ON public.lead_document_templates(organization_id, operation_type);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_documents;

-- RPC to create default templates
CREATE OR REPLACE FUNCTION public.create_default_document_templates(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_template_id uuid;
BEGIN
  -- Compra Financiada
  INSERT INTO lead_document_templates (organization_id, operation_type, name)
  VALUES (p_org_id, 'compra_financiada', 'Compra Financiada') RETURNING id INTO v_template_id;
  INSERT INTO lead_document_template_items (template_id, name, is_required, position) VALUES
    (v_template_id, 'RG ou CNH', true, 1),
    (v_template_id, 'CPF', true, 2),
    (v_template_id, 'Comprovante de Renda', true, 3),
    (v_template_id, 'Comprovante de Residência', true, 4),
    (v_template_id, 'Certidão de Estado Civil', true, 5),
    (v_template_id, 'Declaração de IR', true, 6),
    (v_template_id, 'Extrato FGTS', false, 7),
    (v_template_id, 'Certidão Negativa de Débitos', false, 8);

  -- Compra à Vista
  INSERT INTO lead_document_templates (organization_id, operation_type, name)
  VALUES (p_org_id, 'compra_vista', 'Compra à Vista') RETURNING id INTO v_template_id;
  INSERT INTO lead_document_template_items (template_id, name, is_required, position) VALUES
    (v_template_id, 'RG ou CNH', true, 1),
    (v_template_id, 'CPF', true, 2),
    (v_template_id, 'Comprovante de Residência', true, 3),
    (v_template_id, 'Certidão de Estado Civil', true, 4);

  -- Locação
  INSERT INTO lead_document_templates (organization_id, operation_type, name)
  VALUES (p_org_id, 'locacao', 'Locação') RETURNING id INTO v_template_id;
  INSERT INTO lead_document_template_items (template_id, name, is_required, position) VALUES
    (v_template_id, 'RG ou CNH', true, 1),
    (v_template_id, 'CPF', true, 2),
    (v_template_id, 'Comprovante de Renda', true, 3),
    (v_template_id, 'Comprovante de Residência', true, 4),
    (v_template_id, 'Ficha Cadastral', true, 5),
    (v_template_id, 'Documentos do Fiador', false, 6);

  -- Permuta
  INSERT INTO lead_document_templates (organization_id, operation_type, name)
  VALUES (p_org_id, 'permuta', 'Permuta') RETURNING id INTO v_template_id;
  INSERT INTO lead_document_template_items (template_id, name, is_required, position) VALUES
    (v_template_id, 'RG ou CNH', true, 1),
    (v_template_id, 'CPF', true, 2),
    (v_template_id, 'Matrícula do Imóvel', true, 3),
    (v_template_id, 'Certidão de Ônus Reais', true, 4),
    (v_template_id, 'Laudo de Avaliação', false, 5);
END;
$$;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lead-documents', 'lead-documents', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/jpg'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Org members can upload lead docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lead-documents');

CREATE POLICY "Org members can view lead docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lead-documents');

CREATE POLICY "Org members can update lead docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'lead-documents');

CREATE POLICY "Admins can delete lead docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'lead-documents');

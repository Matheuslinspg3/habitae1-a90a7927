-- Adicionar coluna de tipo de imóvel de interesse
ALTER TABLE public.leads
ADD COLUMN interested_property_type_id UUID REFERENCES public.property_types(id) ON DELETE SET NULL;

-- Adicionar coluna de status ativo/inativo
ALTER TABLE public.leads
ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;

-- Índices para performance
CREATE INDEX idx_leads_is_active ON public.leads(is_active);
CREATE INDEX idx_leads_interested_property_type_id ON public.leads(interested_property_type_id);

-- Comentários
COMMENT ON COLUMN public.leads.interested_property_type_id IS 'Tipo de imóvel que o lead procura';
COMMENT ON COLUMN public.leads.is_active IS 'Se false, lead está inativado e não aparece no Kanban';
-- Criar novos enums
CREATE TYPE public.launch_stage AS ENUM ('nenhum', 'em_construcao', 'pronto');
CREATE TYPE public.property_condition AS ENUM ('novo', 'usado');
CREATE TYPE public.commission_type AS ENUM ('valor', 'percentual');

-- Adicionar novos status ao enum existente
ALTER TYPE public.property_status ADD VALUE IF NOT EXISTS 'com_proposta';
ALTER TYPE public.property_status ADD VALUE IF NOT EXISTS 'suspenso';

-- Adicionar novos campos na tabela properties
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS iptu_monthly DECIMAL,
ADD COLUMN IF NOT EXISTS commission_value DECIMAL,
ADD COLUMN IF NOT EXISTS commission_type public.commission_type DEFAULT 'percentual',
ADD COLUMN IF NOT EXISTS inspection_fee DECIMAL,
ADD COLUMN IF NOT EXISTS launch_stage public.launch_stage DEFAULT 'nenhum',
ADD COLUMN IF NOT EXISTS development_name TEXT,
ADD COLUMN IF NOT EXISTS property_condition public.property_condition,
ADD COLUMN IF NOT EXISTS beach_distance_meters INTEGER,
ADD COLUMN IF NOT EXISTS captador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_properties_captador ON public.properties(captador_id);
CREATE INDEX IF NOT EXISTS idx_properties_launch_stage ON public.properties(launch_stage);
CREATE INDEX IF NOT EXISTS idx_properties_condition ON public.properties(property_condition);

-- Comentarios
COMMENT ON COLUMN public.properties.iptu_monthly IS 'IPTU mensal do imovel';
COMMENT ON COLUMN public.properties.commission_value IS 'Valor da comissao';
COMMENT ON COLUMN public.properties.commission_type IS 'Tipo de comissao: valor fixo ou percentual';
COMMENT ON COLUMN public.properties.inspection_fee IS 'Valor da vistoria';
COMMENT ON COLUMN public.properties.launch_stage IS 'Etapa de lancamento: nenhum, em_construcao, pronto';
COMMENT ON COLUMN public.properties.development_name IS 'Nome do empreendimento';
COMMENT ON COLUMN public.properties.property_condition IS 'Condicao: novo ou usado';
COMMENT ON COLUMN public.properties.beach_distance_meters IS 'Distancia ate a praia em metros';
COMMENT ON COLUMN public.properties.captador_id IS 'Corretor captador do imovel';
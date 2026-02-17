-- =====================================================
-- SISTEMA DE CÓDIGO NUMÉRICO INTELIGENTE PARA IMÓVEIS
-- Formato: CCTTBBSSSS (10 dígitos)
-- CC = Cidade (01-99)
-- TT = Tipo de imóvel (01-15)
-- BB = Zona/Bairro agrupado (01-99)
-- SSSS = Identificador único (1000-9999)
-- =====================================================

-- 1. Tabela de mapeamento de cidades
CREATE TABLE IF NOT EXISTS public.city_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  state VARCHAR(2),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de mapeamento de zonas (agrupamento de bairros)
CREATE TABLE IF NOT EXISTS public.zone_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) NOT NULL,
  name VARCHAR(100) NOT NULL,
  city_code_id UUID REFERENCES public.city_codes(id) ON DELETE CASCADE,
  neighborhoods TEXT[] DEFAULT '{}',
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(code, city_code_id)
);

-- 3. Tabela de mapeamento de tipos de imóvel
CREATE TABLE IF NOT EXISTS public.property_type_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(2) NOT NULL UNIQUE,
  property_type_id UUID REFERENCES public.property_types(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Adicionar coluna property_code à tabela properties
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS property_code VARCHAR(10) UNIQUE;

-- 5. Criar índice para busca por prefixo
CREATE INDEX IF NOT EXISTS idx_properties_code_prefix 
ON public.properties (property_code text_pattern_ops);

-- 6. Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_properties_code 
ON public.properties (property_code);

-- 7. Inserir códigos padrão para tipos de imóvel
INSERT INTO public.property_type_codes (code, name) VALUES
  ('01', 'Apartamento'),
  ('02', 'Casa'),
  ('03', 'Sobrado'),
  ('04', 'Cobertura'),
  ('05', 'Flat'),
  ('06', 'Kitnet'),
  ('07', 'Loft'),
  ('08', 'Studio'),
  ('09', 'Terreno'),
  ('10', 'Sala Comercial'),
  ('11', 'Loja'),
  ('12', 'Galpão'),
  ('13', 'Prédio Comercial'),
  ('14', 'Chácara'),
  ('15', 'Fazenda'),
  ('99', 'Outro')
ON CONFLICT (code) DO NOTHING;

-- 8. Função para gerar código de propriedade
CREATE OR REPLACE FUNCTION public.generate_property_code(
  p_city VARCHAR DEFAULT NULL,
  p_state VARCHAR DEFAULT NULL,
  p_neighborhood VARCHAR DEFAULT NULL,
  p_property_type_id UUID DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL
)
RETURNS VARCHAR(10)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_city_code VARCHAR(2);
  v_type_code VARCHAR(2);
  v_zone_code VARCHAR(2);
  v_sequence VARCHAR(4);
  v_full_code VARCHAR(10);
  v_attempts INT := 0;
  v_max_attempts INT := 100;
BEGIN
  -- 1. Obter código da cidade (criar se não existir)
  SELECT cc.code INTO v_city_code
  FROM city_codes cc
  WHERE LOWER(cc.name) = LOWER(COALESCE(p_city, 'Outros'))
    AND (cc.organization_id = p_organization_id OR cc.organization_id IS NULL)
  LIMIT 1;
  
  IF v_city_code IS NULL THEN
    -- Gerar novo código de cidade
    SELECT LPAD((COALESCE(MAX(code::int), 0) + 1)::text, 2, '0') INTO v_city_code
    FROM city_codes
    WHERE organization_id = p_organization_id OR organization_id IS NULL;
    
    IF v_city_code IS NULL OR v_city_code::int > 99 THEN
      v_city_code := '99';
    END IF;
    
    INSERT INTO city_codes (code, name, state, organization_id)
    VALUES (v_city_code, COALESCE(p_city, 'Outros'), p_state, p_organization_id)
    ON CONFLICT (code) DO NOTHING;
  END IF;
  
  -- 2. Obter código do tipo de imóvel
  SELECT ptc.code INTO v_type_code
  FROM property_type_codes ptc
  LEFT JOIN property_types pt ON pt.id = ptc.property_type_id
  WHERE ptc.property_type_id = p_property_type_id
     OR (p_property_type_id IS NULL AND ptc.code = '99')
  LIMIT 1;
  
  IF v_type_code IS NULL THEN
    -- Tentar mapear pelo nome do tipo
    SELECT ptc.code INTO v_type_code
    FROM property_type_codes ptc
    JOIN property_types pt ON LOWER(pt.name) LIKE '%' || LOWER(ptc.name) || '%'
    WHERE pt.id = p_property_type_id
    LIMIT 1;
    
    IF v_type_code IS NULL THEN
      v_type_code := '99';
    END IF;
  END IF;
  
  -- 3. Obter código da zona (criar se não existir)
  SELECT zc.code INTO v_zone_code
  FROM zone_codes zc
  JOIN city_codes cc ON cc.id = zc.city_code_id
  WHERE cc.code = v_city_code
    AND (
      LOWER(p_neighborhood) = ANY(SELECT LOWER(unnest(zc.neighborhoods)))
      OR LOWER(zc.name) = LOWER(COALESCE(p_neighborhood, 'Centro'))
    )
  LIMIT 1;
  
  IF v_zone_code IS NULL THEN
    -- Criar nova zona para o bairro
    SELECT LPAD((COALESCE(MAX(zc.code::int), 0) + 1)::text, 2, '0') INTO v_zone_code
    FROM zone_codes zc
    JOIN city_codes cc ON cc.id = zc.city_code_id
    WHERE cc.code = v_city_code;
    
    IF v_zone_code IS NULL OR v_zone_code = '' THEN
      v_zone_code := '01';
    END IF;
    
    IF v_zone_code::int <= 99 THEN
      INSERT INTO zone_codes (code, name, neighborhoods, city_code_id, organization_id)
      SELECT v_zone_code, COALESCE(p_neighborhood, 'Centro'), 
             ARRAY[COALESCE(p_neighborhood, 'Centro')], cc.id, p_organization_id
      FROM city_codes cc
      WHERE cc.code = v_city_code
      ON CONFLICT (code, city_code_id) DO NOTHING;
    ELSE
      v_zone_code := '99';
    END IF;
  END IF;
  
  -- 4. Gerar sequência única (4 dígitos, 1000-9999)
  LOOP
    v_sequence := LPAD(
      (1000 + floor(random() * 8999))::text, 
      4, '0'
    );
    
    v_full_code := v_city_code || v_type_code || v_zone_code || v_sequence;
    
    -- Verificar unicidade
    IF NOT EXISTS (SELECT 1 FROM properties WHERE property_code = v_full_code) THEN
      RETURN v_full_code;
    END IF;
    
    v_attempts := v_attempts + 1;
    IF v_attempts >= v_max_attempts THEN
      -- Fallback: usar timestamp
      v_sequence := LPAD(
        ((EXTRACT(EPOCH FROM now())::bigint % 9000) + 1000)::text,
        4, '0'
      );
      v_full_code := v_city_code || v_type_code || v_zone_code || v_sequence;
      RETURN v_full_code;
    END IF;
  END LOOP;
END;
$$;

-- 9. Trigger para gerar código automaticamente
CREATE OR REPLACE FUNCTION public.auto_generate_property_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.property_code IS NULL THEN
    NEW.property_code := generate_property_code(
      NEW.address_city,
      NEW.address_state,
      NEW.address_neighborhood,
      NEW.property_type_id,
      NEW.organization_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_property_code ON public.properties;
CREATE TRIGGER trigger_auto_property_code
  BEFORE INSERT ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_property_code();

-- 10. Função para buscar imóveis por prefixo de código
CREATE OR REPLACE FUNCTION public.search_properties_by_code(
  p_code_prefix VARCHAR,
  p_organization_id UUID,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  property_code VARCHAR,
  title VARCHAR,
  address_city VARCHAR,
  address_neighborhood VARCHAR,
  sale_price NUMERIC,
  rent_price NUMERIC,
  status property_status,
  cover_image_url TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.id,
    p.property_code,
    p.title,
    p.address_city,
    p.address_neighborhood,
    p.sale_price,
    p.rent_price,
    p.status,
    (SELECT pi.url FROM property_images pi WHERE pi.property_id = p.id AND pi.is_cover = true LIMIT 1) as cover_image_url
  FROM properties p
  WHERE p.organization_id = p_organization_id
    AND p.property_code LIKE p_code_prefix || '%'
  ORDER BY p.created_at DESC
  LIMIT p_limit;
$$;

-- 11. Gerar códigos para imóveis existentes que não têm
DO $$
DECLARE
  prop RECORD;
BEGIN
  FOR prop IN 
    SELECT id, address_city, address_state, address_neighborhood, property_type_id, organization_id
    FROM properties
    WHERE property_code IS NULL
  LOOP
    UPDATE properties
    SET property_code = generate_property_code(
      prop.address_city,
      prop.address_state,
      prop.address_neighborhood,
      prop.property_type_id,
      prop.organization_id
    )
    WHERE id = prop.id;
  END LOOP;
END;
$$;

-- 12. RLS para as novas tabelas
ALTER TABLE public.city_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_type_codes ENABLE ROW LEVEL SECURITY;

-- Policies para city_codes
CREATE POLICY "Users can view city codes" ON public.city_codes
  FOR SELECT USING (
    organization_id IS NULL OR 
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Users can insert city codes" ON public.city_codes
  FOR INSERT WITH CHECK (
    organization_id = get_user_organization_id()
  );

-- Policies para zone_codes
CREATE POLICY "Users can view zone codes" ON public.zone_codes
  FOR SELECT USING (
    organization_id IS NULL OR 
    organization_id = get_user_organization_id()
  );

CREATE POLICY "Users can insert zone codes" ON public.zone_codes
  FOR INSERT WITH CHECK (
    organization_id = get_user_organization_id()
  );

-- Policies para property_type_codes (somente leitura - dados globais)
CREATE POLICY "Anyone can view property type codes" ON public.property_type_codes
  FOR SELECT USING (true);
-- =============================================
-- ADMIN ALLOWLIST TABLE + SECURITY FUNCTION
-- =============================================

-- Tabela de emails permitidos para admin do sistema
CREATE TABLE public.admin_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'system'
);

-- Inserir email inicial (Matheus)
INSERT INTO admin_allowlist (email) VALUES ('matheuslinspg@gmail.com');

-- RLS: Bloquear acesso direto - só via SECURITY DEFINER
ALTER TABLE admin_allowlist ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy = ninguém acessa via cliente comum

-- =============================================
-- FUNÇÃO SECURITY DEFINER PARA VERIFICAR ADMIN
-- =============================================

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_allowlist
    WHERE LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
  )
$$;

-- =============================================
-- ENUM E COLUNA PARA TIPO DE IMAGEM
-- =============================================

-- Criar enum para tipos de imagem
CREATE TYPE public.property_image_type AS ENUM (
  'photo',              -- Foto normal
  'floor_plan',         -- Planta baixa principal  
  'floor_plan_secondary' -- Planta baixa secundária (segundo plano)
);

-- Adicionar coluna na tabela de imagens
ALTER TABLE public.property_images 
ADD COLUMN image_type property_image_type DEFAULT 'photo';

-- Índice para consultas por tipo
CREATE INDEX idx_property_images_type ON property_images(property_id, image_type);

-- =============================================
-- FUNÇÕES SQL PARA AGREGAÇÕES DO DASHBOARD
-- =============================================

-- Contagem total de cada tabela principal (para dashboard admin)
CREATE OR REPLACE FUNCTION public.admin_get_table_counts()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Verificar se é admin
  IF NOT is_system_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'properties', (SELECT COUNT(*) FROM properties),
    'properties_active', (SELECT COUNT(*) FROM properties WHERE status = 'disponivel'),
    'leads', (SELECT COUNT(*) FROM leads),
    'leads_active', (SELECT COUNT(*) FROM leads WHERE is_active = true),
    'organizations', (SELECT COUNT(*) FROM organizations),
    'profiles', (SELECT COUNT(*) FROM profiles),
    'property_images', (SELECT COUNT(*) FROM property_images),
    'contracts', (SELECT COUNT(*) FROM contracts),
    'tasks', (SELECT COUNT(*) FROM tasks),
    'appointments', (SELECT COUNT(*) FROM appointments)
  ) INTO result;

  RETURN result;
END;
$$;

-- Contagem de propriedades por status
CREATE OR REPLACE FUNCTION public.admin_get_properties_by_status()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT is_system_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT status, COUNT(*) as count
    FROM properties
    GROUP BY status
    ORDER BY count DESC
  ) t INTO result;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Métricas por organização
CREATE OR REPLACE FUNCTION public.admin_get_org_metrics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT is_system_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT 
      o.id,
      o.name,
      o.type,
      o.created_at,
      (SELECT COUNT(*) FROM properties p WHERE p.organization_id = o.id) as total_properties,
      (SELECT COUNT(*) FROM properties p WHERE p.organization_id = o.id AND p.status = 'disponivel') as active_properties,
      (SELECT COUNT(*) FROM leads l WHERE l.organization_id = o.id) as total_leads,
      (SELECT COUNT(*) FROM leads l WHERE l.organization_id = o.id AND l.is_active = true) as active_leads,
      (SELECT COUNT(*) FROM profiles pr WHERE pr.organization_id = o.id) as total_users,
      (SELECT COUNT(*) FROM property_images pi 
       JOIN properties p ON pi.property_id = p.id 
       WHERE p.organization_id = o.id) as total_images
    FROM organizations o
    ORDER BY total_properties DESC
  ) t INTO result;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Crescimento nos últimos 7 e 30 dias
CREATE OR REPLACE FUNCTION public.admin_get_growth_metrics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT is_system_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'properties_7d', (SELECT COUNT(*) FROM properties WHERE created_at > NOW() - INTERVAL '7 days'),
    'properties_30d', (SELECT COUNT(*) FROM properties WHERE created_at > NOW() - INTERVAL '30 days'),
    'leads_7d', (SELECT COUNT(*) FROM leads WHERE created_at > NOW() - INTERVAL '7 days'),
    'leads_30d', (SELECT COUNT(*) FROM leads WHERE created_at > NOW() - INTERVAL '30 days'),
    'orgs_7d', (SELECT COUNT(*) FROM organizations WHERE created_at > NOW() - INTERVAL '7 days'),
    'orgs_30d', (SELECT COUNT(*) FROM organizations WHERE created_at > NOW() - INTERVAL '30 days'),
    'users_7d', (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '7 days'),
    'users_30d', (SELECT COUNT(*) FROM profiles WHERE created_at > NOW() - INTERVAL '30 days')
  ) INTO result;

  RETURN result;
END;
$$;

-- Verificar inconsistências no sistema
CREATE OR REPLACE FUNCTION public.admin_get_system_health()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT is_system_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'properties_without_type', (SELECT COUNT(*) FROM properties WHERE property_type_id IS NULL),
    'properties_without_price', (SELECT COUNT(*) FROM properties WHERE sale_price IS NULL AND rent_price IS NULL),
    'leads_without_broker', (SELECT COUNT(*) FROM leads WHERE broker_id IS NULL),
    'orphan_images', (SELECT COUNT(*) FROM property_images pi 
                      WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = pi.property_id)),
    'marketplace_access_7d', (SELECT COUNT(*) FROM marketplace_contact_access 
                               WHERE accessed_at > NOW() - INTERVAL '7 days'),
    'contracts_active', (SELECT COUNT(*) FROM contracts WHERE status = 'ativo'),
    'invoices_pending', (SELECT COUNT(*) FROM invoices WHERE status = 'pendente')
  ) INTO result;

  RETURN result;
END;
$$;

-- Estimativa de tamanho por tabela
CREATE OR REPLACE FUNCTION public.admin_get_table_sizes()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT is_system_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT 
      relname as table_name,
      pg_size_pretty(pg_total_relation_size(relid)) as total_size,
      pg_total_relation_size(relid) as size_bytes,
      n_live_tup as row_count
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 20
  ) t INTO result;

  RETURN COALESCE(result, '[]'::json);
END;
$$;
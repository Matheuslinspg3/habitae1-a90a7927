-- ============================================================
-- PORTA DO CORRETOR — ANÁLISE DE PERFORMANCE DE QUERIES
-- ============================================================
-- Propósito : Medir o custo real das 10 queries mais críticas
--             do sistema usando EXPLAIN ANALYZE diretamente no banco.
--
-- Como usar  : Execute este arquivo no Supabase SQL Editor (com
--              Service Role Key ativa), ou via psql:
--                psql "$DATABASE_URL" -f scripts/analyze-performance.sql
--
-- Placeholder: '00000000-0000-0000-0000-000000000000' substitui
--              organization_id / user_id / lead_id reais.
-- ============================================================


-- ============================================================
-- QUERY 1: useDashboardStats — fn_dashboard_stats(org_id)
-- Agrega contagens de imóveis, leads, contratos e transações
-- de uma organização em uma única chamada.
-- Tabelas internas: properties, leads, contracts, transactions
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT public.fn_dashboard_stats('00000000-0000-0000-0000-000000000000'::uuid)
;


-- ============================================================
-- QUERY 2: useDashboardKPIs — fn_kpi_metrics(org_id, start, end)
-- Calcula KPIs do período atual e anterior (leads, visitas,
-- propostas, fechamentos, ticket médio).
-- Tabelas internas: leads, appointments, contracts, lead_stages
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT public.fn_kpi_metrics(
  '00000000-0000-0000-0000-000000000000'::uuid,
  (now() - interval '30 days')::timestamptz,
  now()::timestamptz
)
;


-- ============================================================
-- QUERY 3: useDashboardRanking — fn_agent_ranking(org_id, start, end)
-- Ranking de corretores com correlated subqueries em leads,
-- appointments, contracts e lead_interactions por corretor.
-- ATENÇÃO: padrão N+1 — uma subquery por corretor.
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM public.fn_agent_ranking(
  '00000000-0000-0000-0000-000000000000'::uuid,
  (now() - interval '30 days')::timestamptz,
  now()::timestamptz
)
;


-- ============================================================
-- QUERY 4: useProperties — listagem de imóveis com joins
-- SQL equivalente ao PostgREST gerado pelo Supabase JS:
--   supabase.from('properties')
--     .select('*, property_type:property_types(*), images:property_images(...)')
--     .eq('organization_id', org_id)
--     .order('created_at', { ascending: false })
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  p.*,
  row_to_json(pt.*) AS property_type,
  COALESCE(
    json_agg(
      json_build_object(
        'id',                    pi.id,
        'url',                   pi.url,
        'is_cover',              pi.is_cover,
        'display_order',         pi.display_order,
        'r2_key_full',           pi.r2_key_full,
        'r2_key_thumb',          pi.r2_key_thumb,
        'storage_provider',      pi.storage_provider,
        'cached_thumbnail_url',  pi.cached_thumbnail_url,
        'image_type',            pi.image_type
      )
    ) FILTER (WHERE pi.id IS NOT NULL),
    '[]'::json
  ) AS images
FROM public.properties p
LEFT JOIN public.property_types pt ON pt.id = p.property_type_id
LEFT JOIN public.property_images pi ON pi.property_id = p.id
WHERE p.organization_id = '00000000-0000-0000-0000-000000000000'::uuid
GROUP BY p.id, pt.id
ORDER BY p.created_at DESC
LIMIT 1000
;


-- ============================================================
-- QUERY 5: useLeads — listagem de leads ativos (kanban)
-- SQL equivalente ao PostgREST:
--   supabase.from('leads')
--     .select('*, lead_type:lead_types(*), interested_property_type:property_types(*)')
--     .eq('is_active', true)
--     .order('position', { ascending: true })
-- NOTA: sem filtro de organization_id na query JS — RLS filtra.
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  l.*,
  row_to_json(lt.*) AS lead_type,
  row_to_json(ipt.*) AS interested_property_type
FROM public.leads l
LEFT JOIN public.lead_types lt ON lt.id = l.lead_type_id
LEFT JOIN public.property_types ipt ON ipt.id = l.interested_property_type_id
WHERE l.is_active = true
ORDER BY l.position ASC
;


-- ============================================================
-- QUERY 6: useLeadInteractions — interações de um lead específico
-- SQL equivalente ao PostgREST:
--   supabase.from('lead_interactions')
--     .select('id, lead_id, type, description, occurred_at, created_by, created_at, appointment_id')
--     .eq('lead_id', lead_id)
--     .order('occurred_at', { ascending: false })
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  id,
  lead_id,
  type,
  description,
  occurred_at,
  created_by,
  created_at,
  appointment_id
FROM public.lead_interactions
WHERE lead_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY occurred_at DESC
;


-- ============================================================
-- QUERY 7: useContracts — contratos da org com dados relacionados
-- SQL equivalente ao PostgREST:
--   supabase.from('contracts')
--     .select('id, code, type, status, value, commission_percentage,
--              start_date, end_date, payment_day, readjustment_index,
--              notes, property_id, lead_id, broker_id,
--              created_at, created_by, updated_at, organization_id')
--     .eq('organization_id', org_id)
--     .order('created_at', { ascending: false })
-- (JOINs em properties/leads/profiles feitos em paralelo pelo hook)
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  id,
  code,
  type,
  status,
  value,
  commission_percentage,
  start_date,
  end_date,
  payment_day,
  readjustment_index,
  notes,
  property_id,
  lead_id,
  broker_id,
  created_at,
  created_by,
  updated_at,
  organization_id
FROM public.contracts
WHERE organization_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY created_at DESC
;


-- ============================================================
-- QUERY 8: useTransactions — transações da org com joins embutidos
-- SQL equivalente ao PostgREST:
--   supabase.from('transactions')
--     .select('..., category:transaction_categories(id,name), contract:contracts(id,code)')
--     .eq('organization_id', org_id)
--     .order('date', { ascending: false })
--     .limit(500)
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  t.id,
  t.type,
  t.description,
  t.amount,
  t.date,
  t.paid,
  t.paid_at,
  t.notes,
  t.category_id,
  t.contract_id,
  t.organization_id,
  t.created_by,
  t.created_at,
  json_build_object('id', tc.id, 'name', tc.name) AS category,
  json_build_object('id', c.id,  'code', c.code)  AS contract
FROM public.transactions t
LEFT JOIN public.transaction_categories tc ON tc.id = t.category_id
LEFT JOIN public.contracts c ON c.id = t.contract_id
WHERE t.organization_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY t.date DESC
LIMIT 500
;


-- ============================================================
-- QUERY 9: useMarketplace — busca pública por cidade (view)
-- SQL equivalente ao PostgREST na view marketplace_properties_public:
--   supabase.from('marketplace_properties_public')
--     .select('*', { count: 'exact' })
--     .eq('status', 'disponivel')
--     .neq('organization_id', org_id)
--     .ilike('address_city', '%São Paulo%')
--     .order('is_featured', { ascending: false })
--     .order('created_at', { ascending: false })
--     .range(0, 11)
-- ATENÇÃO: ILIKE com % no início NÃO usa índice B-tree — requer GIN/pg_trgm.
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM public.marketplace_properties_public
WHERE status = 'disponivel'
  AND organization_id <> '00000000-0000-0000-0000-000000000000'::uuid
  AND address_city ILIKE '%São Paulo%'
ORDER BY is_featured DESC, created_at DESC
LIMIT 12
;


-- ============================================================
-- QUERY 10: useNotifications — notificações do usuário (realtime)
-- SQL equivalente ao PostgREST:
--   supabase.from('notifications')
--     .select('*')
--     .eq('user_id', user_id)
--     .order('created_at', { ascending: false })
--     .limit(50)
-- Também usado no filtro realtime (Postgres changes):
--   filter: `user_id=eq.${user.id}`
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM public.notifications
WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY created_at DESC
LIMIT 50
;

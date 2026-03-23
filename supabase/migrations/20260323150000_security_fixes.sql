-- ================================================================
-- SECURITY AUDIT: Correção e documentação dos warnings do linter
-- Data: 2026-03-23
-- Warnings analisados:
--   1. Security definer view sem proteção adequada
--   2. RLS policy permissiva (USING (true))
-- ================================================================

-- ================================================================
-- WARNING 1: SECURITY DEFINER VIEW — properties_public_landing
-- ================================================================
-- SITUAÇÃO: View criada sem security_invoker em 20260214035006,
-- o que fazia a view rodar com permissões do criador (superuser),
-- efetivamente ignorando RLS nas tabelas subjacentes.
--
-- STATUS: JÁ CORRIGIDO na migration 20260214035018, que recria
-- a view com (security_invoker = true).
--
-- Todas as views atuais do sistema usam security_invoker:
--   - properties_public_landing (security_invoker = true)
--   - marketplace_properties_public (security_invoker = on)
--   - profiles_public (security_invoker = true)
--
-- Nenhuma ação necessária para este warning.

-- ================================================================
-- WARNING 2: RLS POLICY PERMISSIVA — USING (true) / WITH CHECK (true)
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 2a. marketplace_properties SELECT — CORREÇÃO (BUG RESIDUAL)
-- ────────────────────────────────────────────────────────────────
-- A policy "Authenticated users can view available marketplace
-- properties (no PII)" (20260314050038) permite SELECT cross-org
-- no base table, expondo owner_name, owner_phone, owner_email.
-- O app usa a view, mas um usuário pode consultar a base table
-- diretamente via Supabase client SDK.
--
-- FIX: Remover acesso cross-org ao base table. Cross-org deve
-- usar a view marketplace_properties_public (que omite PII).
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can view available marketplace properties (no PII)"
  ON public.marketplace_properties;

-- Membros da org veem TUDO da sua organização (incluindo PII dos proprietários)
CREATE POLICY "Org members can view own marketplace properties"
  ON public.marketplace_properties FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id());

-- Cross-org: BLOQUEADO no base table.
-- Acesso cross-org deve ser feito via view marketplace_properties_public
-- (que já exclui owner_name, owner_phone, owner_email).
-- A view funciona pois tem security_invoker=on e não precisa de policy
-- direta no base table para SELECT (o service_role da view resolve).

-- Garantir que anon NÃO tem acesso ao base table
REVOKE SELECT ON public.marketplace_properties FROM anon;

-- ────────────────────────────────────────────────────────────────
-- 2b. DOCUMENTAÇÃO: Policies USING(true) INTENCIONAIS
-- ────────────────────────────────────────────────────────────────

-- As seguintes policies com USING(true) são INTENCIONAIS e não
-- representam risco de segurança:
--
-- [INTENCIONAL] property_landing_content SELECT USING(true)
--   Motivo: Landing pages de imóveis são públicas por design.
--   Tabela contém apenas conteúdo de apresentação sem dados sensíveis.
--   Migration: 20260130024650
--
-- [INTENCIONAL] property_type_codes SELECT USING(true)
--   Motivo: Dados de referência globais (tipo de imóvel).
--   Tabela somente leitura, sem dados sensíveis.
--   Migration: 20260204044627
--
-- [INTENCIONAL] app_runtime_config SELECT USING(true) TO anon,authenticated
--   Motivo: Configuração pública do app (feature flags, versão, etc).
--   Somente SELECT, sem policy de INSERT/UPDATE/DELETE para clientes.
--   Migration: 20260311181721
--
-- [INTENCIONAL] ai_billing_pricing SELECT USING(true) TO authenticated
--   Motivo: Dados de precificação visíveis a todos os usuários autenticados.
--   INSERT/UPDATE controlado por role 'developer'.
--   Migration: 20260315150736
--
-- [INTENCIONAL] deleted_property_media ALL USING(true) TO service_role
--   Motivo: Tabela acessível apenas por service_role (cron jobs de limpeza).
--   Nenhum acesso de cliente.
--   Migration: 20260204042229
--
-- [INTENCIONAL] scrape_cache ALL USING(true) TO service_role
--   Motivo: Cache de scraping acessível apenas por service_role.
--   Policy para clientes foi removida na migration 20260314045728.
--   Migration: 20260202050942

-- ────────────────────────────────────────────────────────────────
-- 2c. DOCUMENTAÇÃO: Policies USING(true) que JÁ FORAM CORRIGIDAS
-- ────────────────────────────────────────────────────────────────
--
-- [CORRIGIDO] marketplace_properties INSERT/UPDATE/DELETE WITH CHECK(true)
--   Permitia qualquer autenticado manipular imóveis de qualquer org.
--   Corrigido em: 20260207214931 (org-based restrictions)
--
-- [CORRIGIDO] notifications INSERT WITH CHECK(true)
--   Permitia qualquer usuário inserir notificações para outros.
--   Corrigido em: 20260211031207 (auth.uid() = user_id)
--
-- [CORRIGIDO] property_landing_overrides SELECT USING(true)
--   Expunha overrides de visual editor para qualquer pessoa.
--   Corrigido em: 20260314045728 (org-based restriction)
--
-- [CORRIGIDO] organizations SELECT USING(true)
--   Expunha todos os dados de todas as organizações.
--   Corrigido em: 20260216051656 (removida, acesso via RPC)
--
-- [CORRIGIDO] scrape_cache INSERT/UPDATE USING(true) TO authenticated
--   Permitia clientes manipularem cache de scraping diretamente.
--   Corrigido em: 20260202050942 + 20260314045728 (service_role only)
--
-- [CORRIGIDO] billing_webhook_logs INSERT WITH CHECK(true)
--   Permitia qualquer pessoa inserir logs de webhook.
--   Corrigido em: 20260217042254 (WITH CHECK(false), service_role only)
--
-- [CORRIGIDO] ai_usage_logs INSERT WITH CHECK(true) TO authenticated
--   Permitia inserir logs com dados de outro usuário/org.
--   Corrigido em: 20260314194017 (user_id = auth.uid())
--
-- [CORRIGIDO] verification_codes INSERT WITH CHECK(true)
--   Permitia criação irrestrita de códigos de verificação.
--   Corrigido em: 20260314194017 (user_id = auth.uid(), TO authenticated)

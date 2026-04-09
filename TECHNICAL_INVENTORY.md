# TECHNICAL INVENTORY — Habitae1

**Data**: 2026-03-18 | **Projeto Supabase**: `aiflfkkjitvsyszwdfga`
**Escopo**: Inventário técnico completo para migração Lovable Cloud → Supabase
**Baseado em**: 206 migrations SQL (2026-01-28 → 2026-03-17) + análise estática do código

---

## ESTATÍSTICAS DO BANCO

| Objeto | Quantidade |
|--------|-----------|
| Tabelas | **58** |
| Views | **4** |
| ENUMs customizados | **20** |
| Funções SQL/PL/pgSQL | **29** |
| Triggers | **23+** |
| Índices | **70+** |
| RLS Policies | **90+** |
| Storage Buckets | **2** |
| Seed records padrão | **40+** |

---

## 1. ENUMS (20 total)

### Organização e Usuários
```sql
CREATE TYPE organization_type AS ENUM ('imobiliaria', 'corretor_individual');
CREATE TYPE app_role AS ENUM ('admin', 'corretor', 'assistente');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');
```

### Imóveis
```sql
CREATE TYPE property_status AS ENUM (
  'disponivel', 'reservado', 'vendido', 'alugado',
  'inativo', 'com_proposta', 'suspenso'
);
CREATE TYPE transaction_type AS ENUM ('venda', 'aluguel', 'ambos');
CREATE TYPE property_visibility_type AS ENUM ('private', 'partners_only', 'public');
CREATE TYPE property_image_type AS ENUM ('photo', 'floor_plan', 'floor_plan_secondary');
CREATE TYPE launch_stage AS ENUM ('nenhum', 'em_construcao', 'pronto');
CREATE TYPE property_condition AS ENUM ('novo', 'usado');
CREATE TYPE commission_type AS ENUM ('valor', 'percentual');
```

### Leads / CRM
```sql
CREATE TYPE lead_stage AS ENUM (
  'novo', 'contato', 'visita', 'proposta',
  'negociacao', 'fechado_ganho', 'fechado_perdido'
);  -- DEPRECATED: substituído por tabela lead_stages
CREATE TYPE interaction_type AS ENUM ('ligacao', 'email', 'visita', 'whatsapp', 'reuniao', 'nota');
CREATE TYPE ad_provider AS ENUM ('meta', 'google');
CREATE TYPE ad_lead_status AS ENUM ('new', 'read', 'sent_to_crm', 'send_failed', 'archived');
CREATE TYPE ad_entity_type AS ENUM ('campaign', 'adset', 'ad');
```

### Financeiro / Contratos
```sql
CREATE TYPE financial_transaction_type AS ENUM ('receita', 'despesa');
CREATE TYPE invoice_status AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
CREATE TYPE contract_status AS ENUM ('rascunho', 'ativo', 'encerrado', 'cancelado');
CREATE TYPE contract_type AS ENUM ('venda', 'locacao');
```

### Assinaturas / Billing
```sql
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'cancelled', 'suspended', 'expired');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');
CREATE TYPE partnership_status AS ENUM ('pending', 'active', 'rejected', 'expired');
```

---

## 2. TABELAS (58 total)

### Grupo: Organização e Usuários

| Tabela | PK | organization_id | RLS | FKs Principais |
|--------|-----|-----------------|-----|---------------|
| `organizations` | UUID | — (raiz) | ✓ | created_by→auth.users |
| `profiles` | UUID | ✓ | ✓ | user_id→auth.users (UNIQUE), organization_id→organizations |
| `user_roles` | UUID | ✓ | ✓ | user_id→auth.users, org_id→organizations. UNIQUE(user_id, org_id) |
| `organization_invites` | UUID | ✓ | ✓ | org_id→organizations, invited_by→auth.users. UNIQUE(org_id, email) |
| `platform_invites` | UUID | ✓ | ✓ | created_by→auth.users, org_id→organizations, used_by_org_id→organizations |
| `admin_allowlist` | UUID | — | ✓ | UNIQUE(email) |
| `verification_codes` | UUID | — | ✓ | user_id→auth.users |

### Grupo: Imóveis

| Tabela | PK | organization_id | RLS | Destaques |
|--------|-----|-----------------|-----|----------|
| `properties` | UUID | ✓ | ✓ | UNIQUE(org_id, source_provider, source_property_id) WHERE source_provider NOT NULL |
| `property_types` | UUID | ✓ | ✓ | |
| `property_images` | UUID | (via property) | ✓ | DEPRECATED parcialmente |
| `property_media` | UUID | ✓ | ✓ | checksum para dedup; kind: cover/gallery/floor_plan/video |
| `deleted_property_media` | UUID | ✓ | ✓ | Audit trail de mídia deletada |
| `property_visibility` | UUID | (via property) | ✓ | UNIQUE(property_id) |
| `property_owners` | UUID | ✓ | ✓ | |
| `property_partnerships` | UUID | ✓ | ✓ | owner_org + partner_org → organizations |
| `property_landing_content` | UUID | (via property) | ✓ | UNIQUE(property_id); conteúdo IA |
| `marketplace_properties` | UUID | ✓ | ✓ | Gate por assinatura |
| `marketplace_contact_access` | UUID | ✓ | ✓ | Rastreamento de visualizações |

### Grupo: CRM / Leads

| Tabela | PK | organization_id | RLS | Destaques |
|--------|-----|-----------------|-----|----------|
| `leads` | UUID | ✓ | ✓ | lead_stage_id→lead_stages (tabela dinâmica) |
| `lead_types` | UUID | ✓ | ✓ | Customizável por org |
| `lead_stages` | UUID | ✓ | ✓ | Pipeline customizável; is_win/is_loss |
| `lead_interactions` | UUID | — (via lead) | ✓ | |
| `lead_score_events` | UUID | ✓ | ✓ | Trigger recalcula score |
| `ad_accounts` | UUID | ✓ | ✓ | UNIQUE(org_id, provider); armazena OAuth tokens |
| `ad_entities` | UUID | ✓ | ✓ | UNIQUE(org_id, provider, entity_type, external_id) |
| `ad_insights_daily` | UUID | ✓ | ✓ | UNIQUE(org_id, provider, entity_type, external_id, date) |
| `ad_leads` | UUID | ✓ | ✓ | UNIQUE(org_id, provider, external_lead_id) |
| `ad_settings` | UUID | ✓ | ✓ | UNIQUE(org_id) |

### Grupo: Contratos e Financeiro

| Tabela | PK | organization_id | RLS | Destaques |
|--------|-----|-----------------|-----|----------|
| `contracts` | UUID | ✓ | ✓ | |
| `contract_documents` | UUID | — (via contract) | ✓ | |
| `transactions` | UUID | ✓ | ✓ | FK opcional para contract |
| `transaction_categories` | UUID | ✓ | ✓ | Customizável por org |
| `invoices` | UUID | ✓ | ✓ | |
| `commissions` | UUID | ✓ | ✓ | |

### Grupo: AI Billing

| Tabela | PK | organization_id | RLS | Destaques |
|--------|-----|-----------------|-----|----------|
| `ai_token_usage_events` | UUID | ✓ | ✓ | total_tokens: GENERATED ALWAYS AS STORED |
| `ai_billing_pricing` | UUID | — (shared) | ✓ | UNIQUE(provider, model) |
| `ai_billing_invoices` | UUID | ✓ | ✓ | |
| `ai_billing_config` | TEXT (`'default'`) | — | ✓ | billing_enabled, sandbox_mode, markup |

### Grupo: Agenda / Tarefas

| Tabela | PK | organization_id | RLS | Destaques |
|--------|-----|-----------------|-----|----------|
| `appointments` | UUID | ✓ | ✓ | Publicado no Realtime |
| `tasks` | UUID | ✓ | ✓ | |

### Grupo: Assinaturas

| Tabela | PK | organization_id | RLS | Destaques |
|--------|-----|-----------------|-----|----------|
| `subscriptions` | UUID | ✓ | ✓ | UNIQUE(org_id) |
| `subscription_plans` | UUID | — (shared) | ✓ | UNIQUE(slug) |
| `marketplace_subscriptions` | UUID | ✓ | ✓ | |

### Grupo: Notificações e Dispositivos

| Tabela | PK | organization_id | RLS | Destaques |
|--------|-----|-----------------|-----|----------|
| `notifications` | UUID | — | ✓ | Trigger → send-push |
| `user_devices` | UUID | — | ✓ | UNIQUE(user_id, onesignal_id) |
| `push_subscriptions` | UUID | ✓ | ✓ | **DEPRECATED** — substituído por user_devices |

### Grupo: Importações e Integrações

| Tabela | PK | organization_id | RLS | Destaques |
|--------|-----|-----------------|-----|----------|
| `import_runs` | UUID | ✓ | ✓ | Status: pending/starting/running/completed/failed/cancelled |
| `import_run_items` | UUID | — (via run) | ✓ | Status: pending/processing/complete/incomplete/error/skipped |
| `imobzi_settings` | UUID | ✓ | ✓ | UNIQUE(org_id); api_key_encrypted no banco |
| `scrape_cache` | UUID | — | Lax | UNIQUE(url_hash); cache compartilhado |

### Grupo: IA / Vídeo / Suporte

| Tabela | PK | organization_id | RLS | Destaques |
|--------|-----|-----------------|-----|----------|
| `generated_videos` | UUID | ✓ | ✓ | job_id para polling de status |
| `brand_settings` | UUID | ✓ | ✓ | UNIQUE(org_id) |
| `support_tickets` | UUID | ✓ | ✓ | |
| `ticket_messages` | UUID | — (via ticket) | ✓ | sender_role: user/ai/support |
| `app_runtime_config` | TEXT (key) | — | ✓ | maintenance_mode, supabase_url |
| `audit_logs` | UUID | ✓ | ✓ | entity_ids: UUID[]; bulk operations |

---

## 3. VIEWS (4 total)

| View | security_invoker | Acesso | Propósito |
|------|-----------------|--------|----------|
| `profiles_public` | `true` | authenticated | Subset seguro de profiles sem dados sensíveis |
| `properties_public_landing` | `true` | anon + authenticated | Imóveis disponíveis para landing pages |
| `marketplace_properties_public` | padrão | authenticated | Marketplace sem dados de contato |

---

## 4. EXTENSÕES POSTGRES

```sql
-- Confirmar disponibilidade na nova instância antes de migrar
uuid-ossp    -- geração de UUIDs (gen_random_uuid() é padrão no PG 13+)
pg_trgm      -- CRÍTICO: busca textual por trigrama (índices GIN nas properties/leads)
unaccent     -- busca sem acento
pg_net       -- CRÍTICO: chamadas HTTP não-bloqueantes do trigger push
```

> **`pg_net` é obrigatório** para o trigger `on_notification_send_push`. Sem ele, push notifications param silenciosamente.

---

## 5. SCHEMAS

Apenas o schema `public` é utilizado. Nenhum schema customizado criado.

---

## 6. FUNÇÕES SQL (29 total)

### Funções de Autorização (SECURITY DEFINER)

| Função | Retorno | Propósito |
|--------|---------|----------|
| `get_user_organization_id()` | UUID | Retorna org do caller via auth.uid() — âncora de toda RLS |
| `is_member_of_org(org_id UUID)` | BOOLEAN | Verifica se caller é membro da org |
| `is_org_admin(user_id UUID)` | BOOLEAN | Verifica role admin na org do usuário |
| `is_org_manager_or_above(user_id UUID)` | BOOLEAN | Verifica roles admin/sub_admin/leader/developer — **sem filtro de org_id próprio** |
| `has_role(user_id UUID, role app_role)` | BOOLEAN | Verifica role específico |
| `get_user_role()` | app_role | Retorna role do caller |
| `is_system_admin()` | BOOLEAN | Verifica email na admin_allowlist |

### Funções de Assinatura / Acesso

| Função | Retorno | Propósito |
|--------|---------|----------|
| `has_active_subscription(org_id UUID)` | BOOLEAN | Gate de marketplace: assinatura ativa |
| `get_subscription_plan_id(org_id UUID)` | UUID | Plano atual da org |
| `get_subscription_plan_slug(org_id UUID)` | TEXT | Slug do plano atual |
| `can_access_marketplace(org_id UUID)` | BOOLEAN | Plano inclui marketplace_access |
| `can_access_partnerships(org_id UUID)` | BOOLEAN | Plano inclui partnership_access |

### Funções de Onboarding

| Função | Propósito |
|--------|----------|
| `handle_new_user()` TRIGGER | Cria automaticamente org, profile e user_role no signup. Verifica invites pendentes. |
| `create_trial_subscription(org_id UUID)` | Cria assinatura trial ao criar nova org |
| `fix_user_without_organization(user_id, email, name)` | Reconstrói org/profile se corrompido |

### Funções de Analytics (STABLE)

| Função | Retorno | Propósito |
|--------|---------|----------|
| `fn_kpi_metrics(org_id, start, end)` | JSONB | KPIs: leads, visitas, propostas, fechamentos, conversão, ticket médio |
| `fn_agent_ranking(org_id, start, end)` | JSONB | Ranking de corretores por performance |
| `fn_funnel_detail(org_id, start, end)` | JSONB | Detalhamento do funil por estágio |
| `fn_pipeline_summary(org_id)` | JSONB | Resumo do pipeline atual |

### Funções de Trigger (Retornam TRIGGER)

| Função | Evento | Tabela | Propósito |
|--------|--------|--------|----------|
| `handle_new_user()` | AFTER INSERT | auth.users | Cria org + profile + role automaticamente |
| `trigger_push_on_notification()` | AFTER INSERT | notifications | Chama /functions/v1/send-push via pg_net |
| `recalculate_lead_score()` | AFTER INSERT | lead_score_events | Recalcula score e temperatura do lead |
| `capture_media_before_property_delete()` | BEFORE DELETE | properties | Move mídia para deleted_property_media |
| `update_updated_at_column()` | BEFORE UPDATE | múltiplas | Mantém updated_at atualizado |

### Funções de Exportação / Admin

| Função | Propósito |
|--------|----------|
| `seed_org_lead_stages(org_id)` | Clona estágios padrão para nova org |
| `log_bulk_operation(org_id, action, entity_type, ids, details)` | Registra operações em lote no audit_log |
| `get_schema_tables_ddl()` | Retorna DDL de todas as tabelas (para export) |
| `get_schema_fk_constraints()` | Retorna ALTER TABLE ADD CONSTRAINT de todas as FKs |
| `count_new_ad_leads(org_id, ad_id)` | Conta leads novos de um anúncio |

---

## 7. TRIGGERS (23+ total)

### Triggers de Negócio

| Trigger | Tabela | Evento | Função |
|---------|--------|--------|--------|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` — **CRÍTICO** |
| `on_notification_send_push` | `notifications` | AFTER INSERT | `trigger_push_on_notification()` |
| `trg_recalculate_lead_score` | `lead_score_events` | AFTER INSERT | `recalculate_lead_score()` |
| `trigger_capture_media_before_delete` | `properties` | BEFORE DELETE | `capture_media_before_property_delete()` |

### Triggers de `updated_at` (19 tabelas)

organizations, profiles, properties, leads, contracts, transactions, invoices,
appointments, tasks, subscription_plans, subscriptions, marketplace_properties,
property_visibility, property_partnerships, property_owners, property_media,
property_landing_content, imobzi_settings, import_run_items

---

## 8. ÍNDICES (70+ total)

### Por Categoria

**Organização:**
`idx_profiles_organization_id`, `idx_profiles_user_id`, `idx_user_roles_user_id`, `idx_user_roles_organization_id`

**Assinaturas:**
`idx_subscriptions_org`, `idx_subscriptions_status`, `idx_subscriptions_period_end`

**Imóveis:**
`idx_properties_organization_id`, `idx_properties_status`, `idx_properties_captador`, `idx_properties_launch_stage`, `idx_properties_condition`, `idx_properties_source_unique (UNIQUE)`, `idx_properties_source_provider`

**Mídia:**
`idx_property_media_property`, `idx_property_media_unprocessed (partial)`, `idx_property_media_checksum`, `idx_property_images_type`

**Marketplace:**
`idx_marketplace_properties_status`, `idx_marketplace_properties_type`, `idx_marketplace_properties_featured`, `idx_marketplace_properties_city`, `idx_property_visibility_property`, `idx_property_visibility_type`

**Leads:**
`idx_leads_organization_id`, `idx_leads_stage`, `idx_leads_is_active`, `idx_ad_leads_dedupe (UNIQUE)`, `idx_ad_leads_by_ad`, `idx_ad_leads_by_status`

**Financeiro:**
`idx_transactions_organization_id`, `idx_audit_logs_org_id`, `idx_audit_logs_created_at`, `idx_audit_logs_entity_type`

**Notificações:**
`idx_user_devices_user_id`, `idx_user_devices_onesignal_id`, `idx_push_subscriptions_user`, `idx_push_subscriptions_org`

**IA Billing:**
`idx_ai_token_usage_user`, `idx_ai_token_usage_provider`, `idx_ai_token_usage_org`, `idx_ai_billing_invoices_user`

**Import:**
`idx_import_runs_org_id`, `idx_import_runs_status`, `idx_import_run_items_run_id`, `idx_import_run_items_status`, `idx_properties_import_status (partial)`, `idx_scrape_cache_url_hash`, `idx_scrape_cache_expires`

**Vídeo:**
`idx_generated_videos_org`, `idx_generated_videos_property`, `idx_generated_videos_job`

---

## 9. CONSTRAINTS NOTÁVEIS

### CHECK Constraints
```sql
import_runs.status IN ('pending', 'starting', 'running', 'completed', 'failed', 'cancelled')
import_run_items.status IN ('pending', 'processing', 'complete', 'incomplete', 'error', 'skipped')
property_media.kind IN ('cover', 'cover_private', 'gallery', 'floor_plan', 'floor_plan_secondary', 'video')
ticket_messages.sender_role IN ('user', 'ai', 'support')
```

### UNIQUE Constraints (mais importantes)
```sql
profiles:              (user_id)
user_roles:            (user_id, organization_id)
organization_invites:  (organization_id, email)
subscriptions:         (organization_id)
property_visibility:   (property_id)
ad_accounts:           (organization_id, provider)
ad_entities:           (organization_id, provider, entity_type, external_id)
ad_insights_daily:     (organization_id, provider, entity_type, external_id, date)
ad_leads:              (organization_id, provider, external_lead_id)
ad_settings:           (organization_id)
brand_settings:        (organization_id)
imobzi_settings:       (organization_id)
subscription_plans:    (slug)
user_devices:          (user_id, onesignal_id)
ai_billing_pricing:    (provider, model)
```

### Coluna Gerada (STORED)
```sql
ai_token_usage_events.total_tokens
  GENERATED ALWAYS AS (input_tokens + output_tokens) STORED

ai_token_usage_events.simulated_bill_amount
  GENERATED ALWAYS AS (...markup formula...) STORED
```

---

## 10. RLS POLICIES (90+ total)

### Padrão Dominante

```sql
-- LEITURA (tabelas com organization_id)
USING (public.is_member_of_org(organization_id))

-- ESCRITA
WITH CHECK (organization_id = public.get_user_organization_id())

-- DELEÇÃO (dados sensíveis)
USING (public.is_member_of_org(organization_id) AND public.is_org_admin(auth.uid()))
```

### Políticas Especiais

| Tabela/Contexto | Política | Risco |
|----------------|---------|-------|
| `organization_invites` | Anon pode ler convites pendentes (pre-signup) | BAIXO — necessário |
| `marketplace_properties` | Requer has_active_subscription() E can_access_marketplace() | MÉDIO — gate por plano |
| `ad_leads` | Requer is_org_manager_or_above() além de org_id | ALTO — função sem filtro de org próprio |
| `scrape_cache` | Todos os autenticados podem ler/escrever | BAIXO — intencional |
| `properties_public_landing` (VIEW) | Anon + authenticated podem ler WHERE status='disponivel' | BAIXO |
| `storage.objects` (property-images) | auth.uid() IS NOT NULL — sem isolamento por org | **ALTO — INSEGURO** |
| `storage.objects` (lead-documents) | auth.uid() IS NOT NULL — sem isolamento por org | **ALTO — INSEGURO** |

---

## 11. DADOS DE SEED (40+ registros)

### `property_types` (12 registros padrão)
Casa, Apartamento, Terreno, Sala Comercial, Loja, Galpão, Cobertura, Sítio/Chácara, Studio/Kitnet, Sobrado, Flat, Fazenda

### `lead_types` (4 registros padrão)
Comprador (#22c55e), Locatário (#3b82f6), Investidor (#f59e0b), Proprietário (#8b5cf6)

### `transaction_categories` (11 registros padrão)
**Receita**: Comissão de Venda, Comissão de Locação, Taxa de Administração, Aluguel Recebido, Outras Receitas
**Despesa**: Salários, Aluguel do Escritório, Marketing, Infraestrutura, Impostos, Outras Despesas

### `lead_stages` (7 registros padrão)
| Nome | Cor | Posição | is_win | is_loss |
|------|-----|---------|--------|---------|
| Novos | #64748b | 0 | — | — |
| Em Contato | #3b82f6 | 1 | — | — |
| Visita Agendada | #eab308 | 2 | — | — |
| Proposta | #f97316 | 3 | — | — |
| Negociação | #a855f7 | 4 | — | — |
| Fechado Ganho | #22c55e | 5 | ✓ | — |
| Fechado Perdido | #ef4444 | 6 | — | ✓ |

### `subscription_plans` (3 registros)
| Plano | Preço Mensal | Preço Anual | max_properties | marketplace |
|-------|-------------|-------------|----------------|-------------|
| Starter | R$79 | R$790 | 10 próprios + 5 shared | 50 views |
| Profissional | R$149 | R$1490 | 50 próprios + 25 shared | sim + partnerships |
| Enterprise | R$299 | R$2990 | Ilimitado | sim + partnerships + priority |

### `ai_billing_pricing` (11 registros)
OpenAI: gpt-4o, gpt-4o-mini, gpt-5, gpt-5-mini, dall-e-3
Google: gemini-2.5-flash, gemini-2.5-pro
Anthropic: claude-3.5-sonnet
Groq: llama-3-70b
Stability: stable-diffusion-xl
Leonardo: leonardo-diffusion-xl

### `admin_allowlist` (1 registro)
```sql
INSERT INTO admin_allowlist (email) VALUES ('matheuslinspg@gmail.com');
```

### `ai_billing_config` (1 registro)
```sql
billing_enabled = false, sandbox_mode = true,
default_markup = 30%, stripe_test_mode = true
```

---

## 12. STORAGE BUCKETS

| Bucket | Acesso | Policies INSERT | Policies DELETE |
|--------|--------|----------------|----------------|
| `property-images` | **público** (SELECT sem auth) | Qualquer autenticado | Qualquer autenticado — **INSEGURO** |
| `brand-assets` | **público** (SELECT sem auth) | Qualquer autenticado | Qualquer autenticado |

> **Nota crítica**: O storage primário de imagens de imóveis é Cloudflare R2 + Cloudinary, NÃO o Supabase Storage. O bucket `property-images` é legado. Buckets `lead-documents` e `pdf-imports` existem mas são criados via migration sem policy documentada explicitamente nos buckets acima.

---

## 13. REALTIME

```sql
-- Tabela publicada no canal realtime
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
```

---

## 14. AUTENTICAÇÃO

### Configuração do Client (Frontend)

**Arquivo**: `src/integrations/supabase/client.ts`

```typescript
createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,     // JWT em localStorage
    persistSession: true,
    autoRefreshToken: true,
  }
})
```

### Fluxo de Signup

O trigger `on_auth_user_created` executa `handle_new_user()` que:
1. Verifica se há invite pendente para o email
2. Se sim: une à org existente com role do convite
3. Se não: cria nova `organizations` + `profiles` + `user_roles` (admin) + `create_trial_subscription()`

### Proteção de Rotas

| Componente | Guard | Destino se falhar |
|-----------|-------|-----------------|
| `ProtectedRoute` | `!user` | `/auth` |
| `ProtectedRoute` | `trial_expired && !isDeveloperOrLeader` | `TrialExpiredScreen` |
| `AdminRoute` | `!isAdmin` | `/acesso-negado` |
| `DeveloperRoute` | `!isDeveloper` | `/acesso-negado` |

---

## 15. EDGE FUNCTIONS (71 total)

### Distribuição por Categoria

| Categoria | Count |
|-----------|-------|
| Admin/Plataforma | 8 |
| Billing (Asaas + Stripe) | 3 |
| Storage (R2 + Cloudinary) | 7 |
| Notificações (OneSignal + Email) | 6 |
| Meta Ads | 5 |
| RD Station | 6 |
| Imobzi | 3 |
| IA/Geração | 11 |
| CRM/Import | 2 |
| Dados/Feed/Export | 4 |
| Manutenção/Admin | 7 |
| Misc (WhatsApp, geocoding, etc.) | 9 |

> Detalhe completo em `EDGE_FUNCTIONS_AUDIT.md`

---

## 16. INTEGRAÇÕES EXTERNAS

| Serviço | Tipo | Secrets | Acoplamento |
|---------|------|---------|-------------|
| Supabase Auth | SDK | Anon Key + Service Role | **Forte** |
| Cloudflare R2 | AWS S3 API | R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME, R2_PUBLIC_URL | **Forte** |
| Cloudinary | REST API | CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET | **Forte** |
| Asaas | REST API | ASAAS_API_KEY, ASAAS_SANDBOX, ASAAS_WEBHOOK_TOKEN | **Forte** |
| OneSignal | REST API + SDK | ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY | **Forte** |
| Resend | REST API | RESEND_API_KEY | **Médio** |
| Meta Ads | OAuth 2.0 | META_APP_ID, META_APP_SECRET | **Médio** |
| RD Station | OAuth 2.0 | RD_STATION_CLIENT_ID, RD_STATION_CLIENT_SECRET | **Médio** |
| Imobzi | REST API | api_key_encrypted no banco | **Médio** |
| Lovable AI | REST API proprietária | LOVABLE_API_KEY | **Médio — risco de portabilidade** |
| OpenAI | REST API | OPENAI_IMAGE_API_KEY | **Médio** |
| Groq | REST API | GROQ_LANDING_KEY_1, GROQ_LANDING_KEY_2 | **Médio** |
| Stability AI | REST API | STABILITY_API_KEY, IMAGE_STABILITY_KEY | **Baixo** |
| Google AI | REST API | GOOGLE_AI_PDF_KEY_1, GOOGLE_AI_PDF_KEY_2 | **Baixo** |
| Stripe | REST API | STRIPE_TEST_SECRET_KEY | **Baixo (modo test)** |
| Cloudflare CDN | REST API | CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_TOKEN | **Baixo** |
| Google Maps | Embed API | VITE_GOOGLE_MAPS_EMBED_KEY | **Fraco** |
| ViaCEP | REST público | nenhum | **Fraco** |
| Nominatim/OSM | REST público | nenhum | **Fraco** |
| Microsoft Clarity | CDN Script | ProjectId hardcoded: `vpil7qz4th` | **Fraco** |

---

## 17. VARIÁVEIS DE AMBIENTE (completo)

### Frontend (VITE_* — expostas no bundle)

```bash
VITE_SUPABASE_URL=https://aiflfkkjitvsyszwdfga.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=aiflfkkjitvsyszwdfga
VITE_R2_PUBLIC_URL=<cdn-url>
VITE_GOOGLE_MAPS_EMBED_KEY=<key>       # Opcional
VITE_RENEWAL_URL=<url>                 # Opcional
VITE_OLLAMA_URL=<url>                  # Opcional (IA local)
VITE_SD_URL=<url>                      # Opcional (Stable Diffusion local)
```

### Backend — Secrets Supabase (nunca expostos no bundle)

```bash
# Supabase auto-injetados em edge functions
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Storage
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_ENDPOINT
R2_BUCKET_NAME
R2_PUBLIC_URL
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLOUDINARY2_CLOUD_NAME        # Backup (opcional)
CLOUDINARY2_API_KEY
CLOUDINARY2_API_SECRET
CLOUDFLARE_ZONE_ID
CLOUDFLARE_API_TOKEN

# Billing
ASAAS_API_KEY
ASAAS_SANDBOX
ASAAS_WEBHOOK_TOKEN

# Notificações
ONESIGNAL_APP_ID
ONESIGNAL_REST_API_KEY

# Email
RESEND_API_KEY

# Integrações OAuth
META_APP_ID
META_APP_SECRET
RD_STATION_CLIENT_ID
RD_STATION_CLIENT_SECRET

# IA / Geração
LOVABLE_API_KEY
GOOGLE_AI_PDF_KEY_1
GOOGLE_AI_PDF_KEY_2
GROQ_LANDING_KEY_1
GROQ_LANDING_KEY_2
OPENAI_IMAGE_API_KEY
STABILITY_API_KEY
IMAGE_STABILITY_KEY

# Billing IA
STRIPE_TEST_SECRET_KEY

# Webhooks externos de IA
GENERATE_ART_WEBHOOK
GENERATE_VIDEO_WEBHOOK

# Runtime / Config
APP_URL                       # https://habitae1.lovable.app
APP_ALLOWED_ORIGINS           # CORS allowlist (CSV)
ENVIRONMENT                   # production | development
```

---

## 18. DEPENDÊNCIAS NPM ESSENCIAIS

```json
{
  "@supabase/supabase-js": "^2.x",
  "@tanstack/react-query": "^5.x",
  "react-hook-form": "^7.x",
  "zod": "^3.x",
  "@tiptap/react": "^2.x",
  "leaflet": "^1.x",
  "recharts": "^2.x",
  "pdf-lib": "^1.x",
  "vite-plugin-pwa": "^0.x",
  "workbox-*": "múltiplos"
}
```

---

## 19. FEATURES DEPRECATED (não remover, mas não expandir)

| Feature | Substituído por |
|---------|---------------|
| `push_subscriptions` table | `user_devices` (OneSignal) |
| `lead_stage` ENUM em `leads` | Tabela `lead_stages` customizável |
| `property_images` table | `property_media` (mais completa) |

---

*Inventário gerado por análise estática de 206 migrations SQL + código-fonte. Nenhuma alteração foi feita no repositório.*

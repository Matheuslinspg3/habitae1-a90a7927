# TECHNICAL INVENTORY — Habitae1

**Data**: 2026-03-18 | **Projeto Supabase**: `aiflfkkjitvsyszwdfga`
**Escopo**: Inventário técnico completo para migração Lovable Cloud → Supabase

---

## 1. BANCO DE DADOS — TABELAS E SCHEMAS

### Schema Principal: `public`

#### Tabelas Identificadas (via migrations + types.ts)

| Tabela | Chave Primária | organization_id | RLS ativa | Notas |
|--------|---------------|-----------------|-----------|-------|
| `profiles` | `id` UUID | ✓ | ✓ | Vincula user_id → organization_id |
| `organizations` | `id` UUID | — (É a raiz) | ✓ | Entidade raiz multi-tenant |
| `user_roles` | `id` UUID | ✓ | ✓ | Roles: admin, sub_admin, leader, developer, broker |
| `organization_invites` | `id` UUID | ✓ | ✓ | Convites pendentes, legíveis por anon |
| `properties` | `id` UUID | ✓ | ✓ | Core: imóveis com tipo, preço, localização |
| `property_types` | `id` UUID | ✓ | ✓ | Tipos customizáveis por org |
| `property_media` | `id` UUID | (via property) | ✓ | R2 keys + Cloudinary IDs |
| `leads` | `id` UUID | ✓ | ✓ | CRM: contatos/prospects |
| `lead_types` | `id` UUID | ✓ | ✓ | Classificação de leads |
| `lead_stages` | `id` UUID | ✓ | ✓ | Pipeline de vendas |
| `lead_sources` | `id` UUID | ✓ | ✓ | Origem dos leads |
| `lead_documents` | `id` UUID | (via lead) | ✓ | Bucket: `lead-documents` |
| `contracts` | `id` UUID | ✓ | ✓ | Tipo: venda \| aluguel |
| `transactions` | `id` UUID | ✓ | ✓ | Financeiro: receitas/despesas |
| `appointments` | `id` UUID | ✓ | ✓ | Agendamentos |
| `tasks` | `id` UUID | ✓ | ✓ | Tarefas dos usuários |
| `owners` | `id` UUID | ✓ | ✓ | Proprietários de imóveis |
| `subscriptions` | `id` UUID | ✓ | ✓ | Assinaturas Asaas |
| `subscription_plans` | `id` UUID | — | ✓ | Planos disponíveis (shared) |
| `billing_payments` | `id` UUID | ✓ | ✓ | Pagamentos por org |
| `ad_accounts` | `id` UUID | ✓ | ✓ | OAuth tokens Meta/outros |
| `ad_leads` | `id` UUID | ✓ | ✓ | Leads vindos de anúncios |
| `activity_log` | `id` UUID | ✓ | ✓ | Auditoria de ações |
| `user_devices` | `id` UUID | — | ✓ | Dispositivos push (por user_id) |
| `notifications` | `id` UUID | — | ✓ | Notificações (por user_id) |
| `ai_token_usage_events` | `id` UUID | ✓ | ✓ | Billing IA |
| `ai_billing_config` | `id` UUID | ✓ | ✓ | Configuração billing IA por org |
| `ai_billing_pricing` | `id` UUID | — | ✓ | Tabela de preços IA (shared) |
| `marketplace_properties` | `id` UUID | ✓ | ✓ | Imóveis no marketplace |
| `marketplace_subscriptions` | `id` UUID | ✓ | ✓ | Assinatura do marketplace |
| `imobzi_settings` | `id` UUID | ✓ | ✓ | Configuração integração Imobzi |
| `rd_station_settings` | `id` UUID | ✓ | ✓ | OAuth RD Station |
| `import_runs` | `id` UUID | ✓ | ✓ | Histórico de importações |
| `import_run_items` | `id` UUID | (via run) | ✓ | Itens de cada importação |
| `automations` | `id` UUID | ✓ | ✓ | Regras de automação |
| `automation_logs` | `id` UUID | ✓ | ✓ | Logs de automação |
| `admin_allowlist` | `id` UUID | — | ✓ | Emails de admin do sistema |
| `app_runtime_config` | `key` TEXT | — | ✓ | Config runtime do app |
| `scrape_cache` | `id` UUID | — | Lax | Cache compartilhado entre orgs |
| `deleted_property_media` | `id` UUID | ✓ | ✓ | Audit de mídia deletada |
| `brand_assets` | `id` UUID | ✓ | ✓ | Assets bucket: `brand-assets` |
| `portal_feeds` | `id` UUID | ✓ | ✓ | Configuração de feeds XML |
| `whatsapp_instances` | `id` UUID | ✓ | ✓ | Instâncias WhatsApp |
| `video_jobs` | `id` UUID | ✓ | ✓ | Jobs de geração de vídeo IA |
| `support_tickets` | `id` UUID | ✓ | ✓ | Tickets de suporte |

### Schema `auth` (gerenciado pelo Supabase)
- `auth.users` — usuários autenticados
- `auth.sessions` — sessões JWT ativas
- Modificado apenas via `supabase.auth.*` SDK methods

### Schema `storage` (gerenciado pelo Supabase)
- `storage.objects` — objetos de arquivos
- `storage.buckets` — configuração de buckets

### Buckets de Storage Identificados
| Bucket | Uso | Políticas RLS |
|--------|-----|--------------|
| `property-images` | Imagens de imóveis (backup/legado) | Qualquer autenticado pode upload/delete — **PERMISSIVO DEMAIS** |
| `brand-assets` | Logos e assets de marca por org | Por org |
| `lead-documents` | PDFs de leads | Qualquer autenticado — **PERMISSIVO DEMAIS** |
| `pdf-imports` | PDFs temporários para importação | Por usuário |

> **Nota**: O storage primário de imagens de imóveis é R2/Cloudinary, NÃO o Supabase Storage.

---

## 2. EXTENSÕES POSTGRES

Identificadas nas migrations iniciais:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Trigram search (LIKE acceleration)
CREATE EXTENSION IF NOT EXISTS "unaccent";      -- Accent-insensitive search
CREATE EXTENSION IF NOT EXISTS "pg_net";        -- HTTP calls from triggers (send-push)
CREATE EXTENSION IF NOT EXISTS "http";          -- Alternativa ao pg_net (pode coexistir)
```

> `pg_net` é **crítico**: é usado pelo trigger `trigger_push_on_notification` para fazer chamadas HTTP sem bloquear a transação.

---

## 3. VIEWS

| View | Definição | security_invoker |
|------|-----------|-----------------|
| `profiles_public` | Subset de profiles sem dados sensíveis | `true` (caller's RLS context) |

---

## 4. FUNÇÕES SQL (PL/pgSQL)

### Funções de Segurança (SECURITY DEFINER)

| Função | Propósito | Tabela consultada |
|--------|-----------|------------------|
| `get_user_organization_id()` | Retorna org do usuário atual via `auth.uid()` | `profiles` |
| `is_member_of_org(_org_id)` | Verifica se caller é membro da org | `profiles` |
| `is_org_admin(_user_id)` | Verifica role admin | `user_roles` |
| `is_org_manager_or_above(_user_id)` | Verifica role manager+ | `user_roles` |
| `is_system_admin()` | Verifica se é admin da plataforma | `admin_allowlist` |
| `has_active_subscription(org_id)` | Verifica assinatura ativa | `subscriptions` |
| `can_access_marketplace(org_id)` | Verifica acesso ao marketplace | `subscriptions`, `subscription_plans` |
| `is_maintenance_blocked()` | Verifica modo manutenção | `app_runtime_config`, `admin_allowlist` |
| `handle_new_user()` | Trigger para novo usuário | `profiles` |
| `create_default_document_templates(org_id)` | Templates padrão de documentos | `lead_documents` |

### Funções de Trigger

| Função | Evento | Tabela | Propósito |
|--------|--------|--------|-----------|
| `trigger_push_on_notification()` | AFTER INSERT | `notifications` | Chama `send-push` via HTTP (pg_net) |
| `handle_new_user()` | AFTER INSERT | `auth.users` | Cria profile automaticamente |
| `update_updated_at_column()` | BEFORE UPDATE | Múltiplas | Atualiza `updated_at` automaticamente |

---

## 5. TRIGGERS

| Trigger | Tabela | Evento | Função |
|---------|--------|--------|--------|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` |
| `push_on_notification_insert` | `notifications` | AFTER INSERT | `trigger_push_on_notification()` |
| `set_updated_at` | Múltiplas tabelas | BEFORE UPDATE | `update_updated_at_column()` |

### Trigger Crítico: `trigger_push_on_notification`

```sql
-- Usa pg_net para HTTP sem bloquear transação
-- Fallback hardcoded para URL do projeto atual
v_url := coalesce(
  current_setting('app.settings.supabase_url', true),
  current_setting('request.headers', true)::jsonb->>'x-supabase-url',
  (SELECT config_value FROM app_runtime_config WHERE config_key = 'supabase_url'),
  'https://aiflfkkjitvsyszwdfga.supabase.co'  -- ← URL HARDCODED
);
```
> **Risco de migração**: URL hardcoded precisa ser atualizada via migration ou `app_runtime_config`.

---

## 6. ÍNDICES

Padrões identificados nas migrations:

```sql
-- Índices GIN para busca textual (pg_trgm)
CREATE INDEX idx_properties_title_trgm ON properties USING GIN (title gin_trgm_ops);
CREATE INDEX idx_leads_name_trgm ON leads USING GIN (name gin_trgm_ops);

-- Índices BTREE por organização (alta cardinalidade)
CREATE INDEX idx_properties_org_id ON properties (organization_id);
CREATE INDEX idx_leads_org_id ON leads (organization_id);
CREATE INDEX idx_transactions_org_id ON transactions (organization_id);

-- Índices compostos
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_subscriptions_org_status ON subscriptions (organization_id, status);

-- Índice para lookup de push
CREATE INDEX idx_user_devices_user_id ON user_devices (user_id);
CREATE INDEX idx_user_devices_onesignal ON user_devices (onesignal_id);
```

---

## 7. ENUMS

```sql
CREATE TYPE ad_provider AS ENUM ('meta', 'google', 'tiktok');
CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE document_type AS ENUM ('rg', 'cpf', 'cnpj', 'passport', 'cnh', 'creci');
CREATE TYPE notification_type AS ENUM ('system', 'lead', 'contract', 'billing', 'task');
CREATE TYPE organization_type AS ENUM ('imobiliaria', 'corretor_individual');
CREATE TYPE subscription_status AS ENUM ('active', 'trial', 'pending', 'cancelled', 'expired');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');
CREATE TYPE import_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE user_role_type AS ENUM ('admin', 'sub_admin', 'leader', 'developer', 'broker', 'viewer');
```

---

## 8. POLICIES RLS (Row Level Security)

### Padrão de Isolamento Multi-Tenant

Todas as tabelas com `organization_id` usam o padrão:

```sql
-- LEITURA: Apenas membros da mesma org
USING (public.is_member_of_org(organization_id))

-- ESCRITA: Apenas para a própria org do usuário
WITH CHECK (organization_id = public.get_user_organization_id())

-- DELEÇÃO (recursos sensíveis): Apenas admins
USING (public.is_member_of_org(organization_id) AND public.is_org_admin(auth.uid()))
```

### Políticas Especiais

| Tabela | Política | Detalhe |
|--------|---------|---------|
| `organization_invites` | Anon pode ler invites pendentes | Necessário para fluxo de aceite pré-cadastro |
| `marketplace_properties` | Requer assinatura ativa com marketplace_access | `can_access_marketplace()` |
| `ad_leads` | Requer role manager+ | `is_org_manager_or_above()` |
| `scrape_cache` | Todos autenticados podem ler/escrever | Cache compartilhado (by design) |
| `admin_allowlist` | Apenas system admins | |

### Buckets com RLS Fraca (RISCO)

```sql
-- property-images: qualquer autenticado pode deletar qualquer imagem
CREATE POLICY "Users can delete their property images"
ON storage.objects FOR DELETE
USING (bucket_id = 'property-images' AND auth.uid() IS NOT NULL);
-- ← Falta: AND (storage.foldername(name))[1] = auth.uid()::text
```

---

## 9. DADOS DE SEED / REFERÊNCIA

Identificados nas migrations:

```sql
-- Admin do sistema
INSERT INTO admin_allowlist (email) VALUES ('matheuslinspg@gmail.com');

-- Planos padrão
INSERT INTO subscription_plans (name, slug, price_monthly, price_yearly, marketplace_access) VALUES
  ('Starter', 'starter', 9700, 97000, false),
  ('Pro', 'pro', 19700, 197000, true),
  ('Enterprise', 'enterprise', 49700, 497000, true);

-- Configuração de runtime padrão
INSERT INTO app_runtime_config (config_key, config_value) VALUES
  ('maintenance_mode', 'false'),
  ('supabase_url', 'https://aiflfkkjitvsyszwdfga.supabase.co');

-- Pricing de IA padrão
INSERT INTO ai_billing_pricing (provider, model, price_per_1k_input_tokens, ...) VALUES
  ('openai', 'gpt-4o', 0.0025, 0.010, 30),
  ('openai', 'gpt-4o-mini', 0.00015, 0.0006, 30),
  ('anthropic', 'claude-3-5-sonnet', 0.003, 0.015, 30),
  ...
```

---

## 10. AUTENTICAÇÃO

### Configuração do Client

**Arquivo**: `src/integrations/supabase/client.ts`

```typescript
createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,     // JWT em localStorage
    persistSession: true,      // Restaura sessão ao recarregar
    autoRefreshToken: true,    // Renova token automaticamente
  }
})
```

### Fluxo de Login (Passo a Passo)

1. `supabase.auth.signInWithPassword(email, password)`
2. SDK armazena JWT + refresh_token em localStorage
3. `onAuthStateChange('SIGNED_IN')` dispara
4. `AuthContext` busca `profiles` + `organizations`
5. Calcula status de trial
6. Inicializa OneSignal com userId
7. `ProtectedRoute` libera acesso às rotas

### Proteção de Rotas

| Tipo | Componente | Verificação |
|------|-----------|-------------|
| Autenticação | `ProtectedRoute` | `!user → /auth` |
| Trial expirado | `ProtectedRoute` | `trialInfo.is_trial_expired && !isDeveloperOrLeader → TrialExpiredScreen` |
| Admin | `AdminRoute` | `!isAdmin → /acesso-negado` |
| Developer | `DeveloperRoute` | `!isDeveloper → /acesso-negado` |

---

## 11. EDGE FUNCTIONS (71 funções Deno)

### Resumo por Categoria

| Categoria | Funções | Públicas (sem JWT) |
|-----------|---------|-------------------|
| Admin/Plataforma | 8 | 3 |
| Billing | 2 | 1 (webhook) |
| Storage | 6 | 2 |
| Notificações | 4 | 2 |
| Meta Ads | 5 | 3 |
| RD Station | 6 | 4 |
| Imobzi | 3 | 0 |
| IA/Geração | 11 | 3 |
| Dados/Export | 4 | 2 |
| Manutenção/Util | 8 | 5 |
| WhatsApp | 2 | 0 |
| Geocoding | 1 | 0 |
| Misc | 11 | 5 |

> Detalhe completo em `EDGE_FUNCTIONS_AUDIT.md`

---

## 12. INTEGRAÇÕES EXTERNAS

| Serviço | Protocolo | Credenciais | Tipo de Acoplamento |
|---------|-----------|-------------|---------------------|
| Supabase Auth | SDK | Anon Key + Service Role | **Forte** — toda auth |
| Cloudflare R2 | AWS S3 API / SigV4 | AccessKey + SecretKey | **Forte** — imagens primárias |
| Cloudinary | REST API | CloudName + ApiKey + ApiSecret | **Forte** — fallback imagens |
| Asaas | REST API | ApiKey (Bearer) | **Forte** — toda billing |
| OneSignal | REST API + SDK | AppId + RestApiKey | **Forte** — push notifications |
| Resend | REST API | ApiKey | **Médio** — emails transacionais |
| Meta Graph API | OAuth 2.0 | AppId + AppSecret | **Médio** — anúncios/leads |
| RD Station | OAuth 2.0 | ClientId + ClientSecret | **Médio** — CRM |
| Imobzi | REST API | ApiKey (por org, no DB) | **Médio** — importação |
| Google Maps | Embed API | EmbedKey | **Fraco** — visualização de mapa |
| OpenStreetMap/Nominatim | REST API | Sem auth | **Fraco** — geocoding |
| Microsoft Clarity | CDN Script | ProjectId (hardcoded) | **Fraco** — analytics |
| ViaCEP | REST API | Sem auth | **Fraco** — busca de CEP |
| Stripe | REST API | TestSecretKey | **Fraco** — billing IA (modo test) |
| Groq | REST API | ApiKey | **Médio** — IA (landing, etc.) |
| OpenAI | REST API | ApiKey | **Médio** — IA (imagens, conteúdo) |
| Anthropic/Claude | REST API | ApiKey | **Médio** — IA (contratos, etc.) |

---

## 13. VARIÁVEIS DE AMBIENTE

### Frontend (`VITE_*` — expostas no bundle)

```bash
VITE_SUPABASE_URL=https://aiflfkkjitvsyszwdfga.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=aiflfkkjitvsyszwdfga
VITE_R2_PUBLIC_URL=<cdn-url>                    # Para resolver URLs de imagem
VITE_GOOGLE_MAPS_EMBED_KEY=<key>                # Opcional
VITE_RENEWAL_URL=<url>                          # Opcional
VITE_OLLAMA_URL=<url>                           # Opcional (IA local)
VITE_SD_URL=<url>                               # Opcional (Stable Diffusion local)
```

### Backend (Secrets Supabase — NUNCA no bundle)

```bash
# Supabase (auto-injetados em edge functions)
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
CLOUDINARY2_CLOUD_NAME        # Backup Cloudinary (opcional)
CLOUDINARY2_API_KEY
CLOUDINARY2_API_SECRET
CLOUDFLARE_ZONE_ID            # Para purge de cache
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

# IA
LOVABLE_API_KEY               # Para generate-* functions
GOOGLE_AI_PDF_KEY_1           # Para extract-property-pdf
GOOGLE_AI_PDF_KEY_2           # Backup
GROQ_LANDING_KEY_1
GROQ_LANDING_KEY_2
OPENAI_IMAGE_API_KEY
STABILITY_API_KEY
IMAGE_STABILITY_KEY

# Misc
STRIPE_TEST_SECRET_KEY        # AI billing stripe
GENERATE_ART_WEBHOOK          # URL de webhook para geração de arte
GENERATE_VIDEO_WEBHOOK        # URL de webhook para geração de vídeo
APP_URL                       # https://habitae1.lovable.app
APP_ALLOWED_ORIGINS           # CORS allowlist (CSV)
ENVIRONMENT                   # production | development
```

---

## 14. DEPENDÊNCIAS CRÍTICAS DE CÓDIGO

### Dependências npm Essenciais

```json
{
  "@supabase/supabase-js": "^2.x",          // Core - toda a integração
  "@tanstack/react-query": "^5.x",          // Cache + sync de dados
  "react-hook-form": "^7.x",               // Formulários
  "zod": "^3.x",                           // Validação de schema
  "@tiptap/react": "^2.x",                 // Editor de rich text (contratos, landing)
  "leaflet": "^1.x",                       // Mapas
  "recharts": "^2.x",                      // Gráficos (dashboard)
  "pdf-lib": "^1.x",                       // Geração/processamento PDF
  "vite-plugin-pwa": "^0.x",              // PWA + Service Worker
  "workbox-*": "múltiplos"                 // PWA caching strategies
}
```

---

*Inventário gerado por análise estática — nenhuma alteração foi feita no repositório.*

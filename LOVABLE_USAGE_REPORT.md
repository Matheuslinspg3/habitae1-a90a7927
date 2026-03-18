# LOVABLE USAGE REPORT — Habitae1

**Data da análise**: 2026-03-18
**Branch analisada**: `claude/analyze-lovable-usage-lJsoT`
**Projeto Supabase**: `aiflfkkjitvsyszwdfga`
**URL do app**: `https://habitae1.lovable.app`

---

## 1. VISÃO GERAL DO PROJETO

**Habitae** é um ERP Imobiliário completo construído sobre a stack Lovable Cloud:

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind + shadcn/ui |
| Backend | Supabase (Postgres + Auth + Edge Functions + Storage) |
| Armazenamento | Cloudflare R2 (primário) + Cloudinary (fallback) |
| Pagamentos | Asaas (processador BR) |
| Notificações | OneSignal (push) + Resend (email) |
| IA | Stable Diffusion / Flux / OpenAI / Anthropic / Gemini |
| Integrações | Imobzi, Meta Ads, RD Station, portais XML |

---

## 2. ACESSO AO BANCO DE DADOS

### 2.1 Client Supabase (Frontend)

**Arquivo crítico**: `src/integrations/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

- Todas as queries do frontend passam por este cliente singleton
- Usa Row Level Security (RLS) do Supabase automaticamente
- Anon key exposta no bundle (`VITE_SUPABASE_PUBLISHABLE_KEY`)

### 2.2 Admin Client (Edge Functions)

Padrão usado em ~50+ edge functions:

```typescript
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // bypassa RLS
);
```

### 2.3 Principais Tabelas Acessadas

| Tabela | Operações | Onde |
|--------|-----------|------|
| `profiles` | SELECT, UPDATE | hooks, auth, edge functions |
| `organizations` | SELECT, UPDATE | auth context, billing, admin |
| `properties` | CRUD completo | 15+ hooks |
| `leads` | CRUD completo | CRM hooks |
| `contracts` | CRUD completo | contracts hooks |
| `subscriptions` | SELECT, UPDATE | billing, auth |
| `billing_payments` | INSERT, SELECT | billing function |
| `ad_accounts` | CRUD | Meta/RD hooks |
| `notifications` | INSERT, SELECT | notification hooks |
| `user_devices` | UPSERT, DELETE | OneSignal service |
| `activity_log` | INSERT | múltiplos serviços |
| `ai_token_usage_events` | INSERT | ai-billing service |

### 2.4 Volume de Migrações

- **206 migrações SQL** em `supabase/migrations/`
- Período: Jan 28 → Mar 17, 2026
- Inclui: criação de tabelas, índices, triggers, funções PL/pgSQL, RLS policies, extensões

---

## 3. AUTENTICAÇÃO (AUTH)

### 3.1 Contexto de Auth (Frontend)

**Arquivo crítico**: `src/contexts/AuthContext.tsx`

- Gerencia: `user`, `session`, `profile`, `organizationType`, `trialInfo`
- Métodos expostos: `signUp`, `signIn`, `signOut`, `refreshProfile`
- Detecta expiração de trial com lógica baseada em `organizations.trial_ends_at`
- Integra com OneSignal no login/logout para sincronizar dispositivos

### 3.2 Padrão de Auth em Edge Functions

```typescript
// Extração do JWT do header
const authHeader = req.headers.get('Authorization');
const token = authHeader.replace('Bearer ', '');

// Validação de claims
const { data: claimsData, error } = await supabaseClient.auth.getClaims(token);
const userId = claimsData.claims.sub;

// Resolução da organização
const { data: profile } = await supabase
  .from('profiles')
  .select('organization_id')
  .eq('user_id', userId)
  .single();
```

### 3.3 Funções sem JWT (públicas/webhooks)

29+ funções com `verify_jwt = false` no `supabase/config.toml`:

```
admin-users, platform-signup, send-invite-email, send-reset-email,
send-push, meta-oauth-callback, meta-app-id, cleanup-orphan-media,
migrate-to-r2, r2-presign, meta-sync-leads, meta-sync-entities,
onesignal-app-id, cloudflare-purge-cache, admin-subscriptions,
rd-station-webhook, meta-save-account, ticket-chat, rd-station-sync-leads,
rd-station-oauth-callback, rd-station-app-id, rd-station-send-event,
toggle-maintenance-mode, export-database, generate-ad-content,
generate-ad-image, test-ai-connection, analyze-photo-quality,
generate-property-art, generate-property-video, video-job-status,
cancel-video-job, summarize-lead, validate-document,
generate-contract-template
```

---

## 4. STORAGE / UPLOAD DE ARQUIVOS

### 4.1 Arquitetura Dual de Storage

#### Primário: Cloudflare R2
- **Função**: `supabase/functions/r2-upload/index.ts`, `supabase/functions/r2-presign/index.ts`
- Fluxo: frontend solicita URL presignada → upload direto do browser → R2
- Variantes: `r2_key_full` (imagem completa) e `r2_key_thumb` (miniatura)
- Credenciais: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`

#### Fallback: Cloudinary
- **Função**: `supabase/functions/cloudinary-sign/index.ts`
- Deduplicação via hash SHA-1 do arquivo como `public_id`
- Transformações: `c_limit,w_2048,h_2048/q_auto:good/fl_strip_profile`
- Credenciais: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### 4.2 Hook de Upload (Frontend)

**Arquivo crítico**: `src/hooks/useImageUpload.ts`

- Adquire URL presignada R2 → gera hash perceptual para detecção de duplicatas
- Geração de variantes via Canvas API (thumb + full)
- Fallback para upload direto via service role se presign falhar
- Detecção de duplicatas por perceptual hash (`src/lib/imagePhash.ts`)

### 4.3 Resolução de URLs de Imagem

**Arquivo crítico**: `src/lib/imageUrl.ts`
- Resolver unificado: R2 → Cloudinary → URL direta
- Suporte a variantes (thumb/full) com fallback automático

---

## 5. EDGE FUNCTIONS (71 funções Deno)

### 5.1 Distribuição por Categoria

| Categoria | Quantidade | Exemplos |
|-----------|-----------|---------|
| Admin/Plataforma | 8 | admin-users, platform-signup, toggle-maintenance-mode |
| Billing | 2 | billing, admin-subscriptions |
| Storage | 5 | r2-upload, r2-presign, cloudinary-sign, cloudflare-purge-cache, migrate-to-r2 |
| Notificações | 3 | send-push, send-invite-email, send-reset-email |
| Integrações Meta | 5 | meta-oauth-callback, meta-sync-leads, meta-sync-entities, meta-app-id, meta-save-account |
| Integrações RD Station | 6 | rd-station-oauth-callback, rd-station-sync-leads, rd-station-send-event, rd-station-stats, rd-station-webhook, rd-station-app-id |
| Integração Imobzi | 1 | imobzi-import |
| IA/Geração | 10 | generate-property-art, generate-property-video, generate-ad-content, generate-ad-image, analyze-photo-quality, summarize-lead, contract-ai-fill, generate-contract-template, test-ai-connection, generate-landing-content |
| CRM/Leads | 2 | crm-import-leads, rd-station-sync-leads |
| Dados/Export | 3 | portal-xml-feed, export-database, validate-document |
| Manutenção | 2 | cleanup-orphan-media, onesignal-app-id |

### 5.2 Utilitários Compartilhados (`_shared/`)

| Arquivo | Responsabilidade |
|---------|----------------|
| `logger.ts` | Logger com redação de PII (CPF, CNPJ, email, tokens) |
| `ai-billing.ts` | Rastreamento de uso de tokens IA com pricing e markup |
| `notification-service.ts` | Serviço de push via OneSignal (registro, envio, limpeza) |

---

## 6. VARIÁVEIS DE AMBIENTE

### 6.1 Frontend (expostas no bundle via `VITE_*`)

```bash
VITE_SUPABASE_URL=https://aiflfkkjitvsyszwdfga.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...   # Anon key (seguro expor)
VITE_SUPABASE_PROJECT_ID=aiflfkkjitvsyszwdfga
VITE_GOOGLE_MAPS_EMBED_KEY                  # Opcional - Google Maps
VITE_RENEWAL_URL                            # Opcional - renovação de plano
VITE_OLLAMA_URL                             # Opcional - IA local
VITE_SD_URL                                 # Opcional - Stable Diffusion local
```

### 6.2 Backend (secrets em Deno runtime - NÃO expostas)

```bash
# Supabase (auto-injetados)
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Notificações
ONESIGNAL_APP_ID
ONESIGNAL_REST_API_KEY

# Storage
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_ENDPOINT
R2_PUBLIC_URL

# Pagamentos
ASAAS_API_KEY
ASAAS_SANDBOX

# Email
RESEND_API_KEY

# Lovable
LOVABLE_API_KEY

# Runtime
ENVIRONMENT
APP_ALLOWED_ORIGINS
```

---

## 7. MIGRAÇÕES E ESTRUTURA DE DADOS

### 7.1 Enums Definidos

```sql
ad_provider, transaction_type, document_type, notification_type,
property_status, lead_temperature, billing_cycle, subscription_status,
organization_type (imobiliaria | corretor_individual)
```

### 7.2 Tabelas Principais (identificadas via types.ts + migrations)

```
profiles              — usuário + organização + verificação
organizations         — dados da imobiliária/corretor + trial
properties            — imóveis com campos ricos
property_types        — tipos de imóvel
leads                 — contatos/leads do CRM
lead_stages           — estágios do pipeline
lead_types            — classificação de leads
contracts             — contratos venda/aluguel
transactions          — movimentações financeiras
ad_accounts           — contas de anúncio (Meta/outros)
activity_log          — auditoria de ações
user_devices          — dispositivos para push
notifications         — notificações do sistema
subscriptions         — assinaturas com Asaas
subscription_plans    — planos disponíveis
billing_payments      — pagamentos realizados
ai_billing_config     — configuração de billing de IA
ai_token_usage_events — eventos de uso de tokens IA
```

### 7.3 Triggers Notáveis

```sql
trigger_push_on_notification()
  — Disparado no INSERT em notifications
  — Chama a edge function /functions/v1/send-push via HTTP
  — Fallback hardcoded com URL do projeto se env vars ausentes
```

---

## 8. INTEGRAÇÕES EXTERNAS

| Serviço | Tipo | Autenticação | Funções |
|---------|------|-------------|---------|
| **Asaas** | Pagamentos BR (PIX/Boleto/CC) | API Key | `billing` |
| **OneSignal** | Push notifications | App ID + REST Key | `send-push`, `onesignal-app-id` |
| **Resend** | Email transacional | API Key | `send-invite-email`, `send-reset-email` |
| **Cloudinary** | CDN de imagens | Cloud Name + API Key/Secret | `cloudinary-sign` |
| **Cloudflare R2** | Object storage | Access Key + Secret | `r2-upload`, `r2-presign` |
| **Meta/Facebook** | Ads + Leads | OAuth 2.0 | `meta-oauth-callback`, `meta-sync-*` |
| **RD Station** | CRM | OAuth 2.0 | `rd-station-oauth-callback`, `rd-station-*` |
| **Imobzi** | Sistema imobiliário | API Key | `imobzi-import` |
| **Google Maps** | Mapas embed | Embed Key | `VITE_GOOGLE_MAPS_EMBED_KEY` |
| **Microsoft Clarity** | Analytics | Script | `src/lib/clarity.ts` |
| **ViaCEP** | CEP brasileiro | Sem auth | `src/lib/viaCep.ts` |
| **IA (múltiplos)** | Geração conteúdo | API Keys por provider | `generate-*`, `analyze-*` |

---

## 9. SERVIÇOS E HOOKS CRÍTICOS

### 9.1 Services (`src/services/`)

```
ai-billing/
  ├── ai-billing.ts          — Interface de rastreamento de billing IA
  ├── pricing-calculator.ts  — Cálculo de custo por token/provider
  ├── token-tracker.ts       — Agregação de uso de tokens
  ├── stripe-adapter.ts      — Integração Stripe meter (billing SaaS)
  └── types.ts               — TokenUsageEvent, PricingConfig, BillingInvoice
```

### 9.2 Hooks de Dados (`src/hooks/`)

```
useLeads.ts             — CRUD leads + pipeline
useProperties.ts        — CRUD propriedades + filtros + busca
useContracts.ts         — Gestão de contratos
useTransactions.ts      — Transações financeiras
useTeamMembers.ts       — Gestão de equipe
useDashboardStats.ts    — KPIs e métricas
useAutomations.ts       — Automações de workflow
useNotifications.ts     — Notificações do sistema
usePushNotifications.ts — Permissão e registro push
useImageUpload.ts       — Upload com R2 + Cloudinary
useImobziImport.ts      — Importação Imobzi
useRDStationSettings.ts — OAuth RD Station
useAdSettings.ts        — Configuração anúncios
useMetaSync.ts          — Sincronização Meta Ads
```

---

## 10. SEGURANÇA E PADRÕES OBSERVADOS

### 10.1 Isolamento por Organização
- Toda query inclui `organization_id` extraído via `profiles`
- RLS policies no banco impedem vazamento cross-tenant

### 10.2 Proteção de PII (Logger compartilhado)
Campos redatados automaticamente nos logs:
`password, token, authorization, secret, api_key, cpf, cnpj, card_number, email, phone`

Padrões regex redatados: CPF, CNPJ, endereços de email

### 10.3 CORS
- Allowlist configurada via `APP_ALLOWED_ORIGINS`
- Fail-closed: bloqueia se env não configurada (na função billing)
- Headers padrão Supabase nas demais funções

### 10.4 Gestão de Secrets
- Service role key: apenas em edge functions (Deno runtime isolado)
- Anon key: bundle do frontend (correto — é pública por design)
- Todas as credenciais externas: secrets do Supabase (nunca no bundle)

---

## 11. ARQUIVOS CRÍTICOS

### Infraestrutura / Config
```
supabase/config.toml                          — Config de 71 edge functions + JWT policies
supabase/migrations/                          — 206 migrações SQL (toda a estrutura do banco)
.env / .env.example                           — Variáveis de ambiente (template)
vite.config.ts                               — PWA, build, dev server
```

### Integração Supabase (Frontend)
```
src/integrations/supabase/client.ts          — Singleton do cliente Supabase
src/integrations/supabase/types.ts           — Tipos gerados do schema (45K+ linhas)
src/contexts/AuthContext.tsx                 — Contexto global de autenticação
```

### Auth & Sessão
```
src/contexts/AuthContext.tsx                 — Auth state, trial, org type
src/contexts/DemoContext.tsx                 — Modo demo (sem DB real)
```

### Storage
```
src/hooks/useImageUpload.ts                  — Hook de upload R2 + Cloudinary
src/lib/imageUrl.ts                          — Resolver de URLs de imagem
src/lib/imagePhash.ts                        — Hash perceptual para deduplicação
src/lib/imageVariants.ts                     — Geração de variantes via Canvas
supabase/functions/r2-upload/index.ts        — Upload direto para R2
supabase/functions/r2-presign/index.ts       — URLs presignadas R2
supabase/functions/cloudinary-sign/index.ts  — Assinatura Cloudinary
```

### Billing
```
supabase/functions/billing/index.ts          — Integração Asaas (pagamentos BR)
src/services/ai-billing/                     — Rastreamento de billing IA
supabase/functions/_shared/ai-billing.ts     — Billing IA nas edge functions
```

### Notificações
```
src/lib/onesignal.ts                         — SDK OneSignal (489 linhas)
supabase/functions/send-push/index.ts        — Disparo de push (via DB trigger)
supabase/functions/_shared/notification-service.ts — Serviço de notificações
supabase/functions/send-invite-email/index.ts — Email de convite (Resend)
supabase/functions/send-reset-email/index.ts  — Email de reset (Resend)
```

### Integrações Externas
```
supabase/functions/meta-oauth-callback/index.ts     — OAuth Meta Ads
supabase/functions/meta-sync-leads/index.ts         — Sincronização leads Meta
supabase/functions/rd-station-oauth-callback/index.ts — OAuth RD Station
supabase/functions/rd-station-sync-leads/index.ts   — Sincronização leads RD
supabase/functions/imobzi-import/index.ts           — Importação Imobzi
supabase/functions/portal-xml-feed/index.ts         — Feed XML portais imobiliários
```

### IA / Geração
```
supabase/functions/generate-property-art/index.ts   — Geração imagem IA
supabase/functions/generate-property-video/index.ts — Geração vídeo IA
supabase/functions/generate-ad-content/index.ts     — Copywriting IA
supabase/functions/analyze-photo-quality/index.ts   — Análise qualidade foto IA
supabase/functions/summarize-lead/index.ts          — Resumo de lead IA
supabase/functions/contract-ai-fill/index.ts        — Preenchimento contrato IA
```

### Utilitários Compartilhados
```
supabase/functions/_shared/logger.ts         — Logger com redação de PII
src/lib/viaCep.ts                            — Lookup de CEP brasileiro
src/lib/clarity.ts                           — Analytics Microsoft Clarity
```

---

## 12. RESUMO TÉCNICO

### Uso do Lovable Cloud (Supabase)

O projeto usa **todas as features principais do Lovable Cloud/Supabase**:

1. **Database (Postgres)**: 20+ tabelas com RLS, 206 migrações, triggers PL/pgSQL
2. **Auth**: JWT com persistência em localStorage, multi-tenant via `organization_id`
3. **Edge Functions**: 71 funções Deno deployadas, incluindo webhooks públicos e funções protegidas por JWT
4. **Storage**: *Não usa Supabase Storage diretamente* — usa Cloudflare R2 (primário) e Cloudinary (fallback)
5. **Realtime**: Implícito via React Query + refetch, sem Supabase Realtime subscriptions identificadas

### Pontos de Atenção

| # | Item | Risco |
|---|------|-------|
| 1 | 29+ funções sem JWT verificado | Médio — requerem validação própria interna |
| 2 | Trigger com URL hardcoded do projeto | Baixo — fallback intencional |
| 3 | `VITE_SUPABASE_PUBLISHABLE_KEY` no bundle | Esperado — anon key é pública por design |
| 4 | Billing IA com markup de 30% hardcoded | Baixo — lógica de negócio no código |
| 5 | OAuth tokens em `ad_accounts.auth_payload` | Alto — dado sensível em coluna JSON |

### Escala

- **71 edge functions** com lógica de negócio significativa
- **206 migrações** indicam desenvolvimento ativo e frequente
- **75+ hooks** de React para acesso ao banco
- **10 integrações externas** ativas
- **Múltiplos providers de IA** com billing rastreado

---

*Relatório gerado por análise estática do código. Nenhuma alteração foi feita no repositório.*

# MIGRATION SCOPE MATRIX — Habitae1

**Data**: 2026-03-18 | **Objetivo**: Migração Lovable Cloud → Supabase self-hosted / novo projeto

---

## LEGENDA

| Campo | Valores |
|-------|---------|
| **Tipo de Migração** | `direta` / `adaptação` / `revisão manual` / `alto risco` |
| **Risco** | `BAIXO` / `MÉDIO` / `ALTO` / `CRÍTICO` |
| **Prioridade Validação** | 1 (crítico) → 5 (baixo) |
| **Revisão Humana** | `SIM` / `NÃO` |

---

## SEÇÃO 1: BANCO DE DADOS

### 1.1 Migrações SQL

| Componente | Localização | Função no Sistema | Dependências | Tipo Migração | Risco | Ação Recomendada | Revisão Humana |
|-----------|------------|-------------------|-------------|--------------|-------|-----------------|---------------|
| 206 migrações SQL | `supabase/migrations/` | Define toda estrutura do banco | Todas as tabelas, funções, políticas | **direta** | MÉDIO | `supabase db push` na nova instância | NÃO |
| Seed data (admin_allowlist) | Migration `20260131032255` | Define admin do sistema (hardcoded) | `is_system_admin()` | **revisão manual** | ALTO | Confirmar email do admin antes de migrar | **SIM** |
| Seed data (subscription_plans) | Migration `20260130020040` | Planos de assinatura com preços | `subscriptions`, billing | **direta** | MÉDIO | Verificar preços antes de migrar | NÃO |
| Seed data (ai_billing_pricing) | Migration (pricing table) | Preços de IA para billing | `ai_token_usage_events` | **adaptação** | MÉDIO | Verificar se preços estão atualizados | NÃO |
| Seed data (app_runtime_config) | Migration | Config runtime, incl. URL do projeto | Trigger push | **revisão manual** | ALTO | Atualizar URL após migração | **SIM** |

### 1.2 Extensões Postgres

| Componente | Localização | Função no Sistema | Dependências | Tipo Migração | Risco | Ação Recomendada | Revisão Humana |
|-----------|------------|-------------------|-------------|--------------|-------|-----------------|---------------|
| `uuid-ossp` | Migration inicial | Geração de UUIDs | Todas as tabelas | **direta** | BAIXO | Verificar disponibilidade | NÃO |
| `pg_trgm` | Migration inicial | Busca textual por trigram | Índices GIN em properties, leads | **direta** | BAIXO | Verificar disponibilidade | NÃO |
| `unaccent` | Migration inicial | Busca sem acento | Queries de busca | **direta** | BAIXO | Verificar disponibilidade | NÃO |
| `pg_net` | Migration | HTTP calls de triggers sem bloquear | Trigger `push_on_notification` | **revisão manual** | CRÍTICO | Verificar se pg_net está disponível na nova instância | **SIM** |

### 1.3 Funções SQL e Triggers

| Componente | Localização | Função no Sistema | Dependências | Tipo Migração | Risco | Ação Recomendada | Revisão Humana |
|-----------|------------|-------------------|-------------|--------------|-------|-----------------|---------------|
| `get_user_organization_id()` | Migration | Isolamento multi-tenant — núcleo de toda RLS | `profiles`, `auth.uid()` | **direta** | CRÍTICO | Deve existir ANTES das policies RLS | **SIM** |
| `is_member_of_org()` | Migration | Isolamento multi-tenant | `profiles`, `auth.uid()` | **direta** | CRÍTICO | Criar antes das policies | **SIM** |
| `is_org_admin()` | Migration | Controle de acesso admin | `user_roles`, `profiles` | **direta** | ALTO | Criar antes das policies | **SIM** |
| `is_org_manager_or_above()` | Migration | Acesso a ad_leads | `user_roles` — **SEM filtro org_id próprio** | **revisão manual** | ALTO | Verificar uso correto (sempre com contexto de org) | **SIM** |
| `is_system_admin()` | Migration | Admin da plataforma | `admin_allowlist` | **adaptação** | ALTO | Seed do admin_allowlist antes de ativar | **SIM** |
| `has_active_subscription()` | Migration | Gate de marketplace | `subscriptions`, `subscription_plans` | **direta** | MÉDIO | Criar antes das policies de marketplace | NÃO |
| `can_access_marketplace()` | Migration | Gate de marketplace | `subscriptions` | **direta** | MÉDIO | Criar antes das policies | NÃO |
| `is_maintenance_blocked()` | Migration | Modo manutenção | `app_runtime_config`, `admin_allowlist` | **adaptação** | BAIXO | Garantir `maintenance_mode=false` no seed | NÃO |
| `handle_new_user()` | Migration | Cria profile automaticamente no signup | `profiles`, `auth.users` | **direta** | CRÍTICO | Trigger crítico — verificar se ativo após migração | **SIM** |
| `trigger_push_on_notification()` | Migration | Dispara push ao inserir notificação | `pg_net`, URL hardcoded | **revisão manual** | ALTO | Atualizar URL da edge function no config | **SIM** |
| `update_updated_at_column()` | Migration | Mantém `updated_at` atualizado | Todas tabelas com updated_at | **direta** | BAIXO | Migrar junto com tabelas | NÃO |

### 1.4 RLS Policies

| Componente | Localização | Função no Sistema | Dependências | Tipo Migração | Risco | Ação Recomendada | Revisão Humana |
|-----------|------------|-------------------|-------------|--------------|-------|-----------------|---------------|
| RLS em `properties` | Migrations | Isolamento de imóveis por org | `is_member_of_org()` | **direta** | MÉDIO | Migrar após funções SECURITY DEFINER | NÃO |
| RLS em `leads` | Migrations | Isolamento de leads por org | `is_member_of_org()` | **direta** | MÉDIO | Migrar após funções | NÃO |
| RLS em `contracts` / `transactions` | Migrations | Isolamento financeiro por org | `is_member_of_org()` | **direta** | MÉDIO | Migrar após funções | NÃO |
| RLS em `subscriptions` | Migrations | Acesso à própria assinatura | `get_user_organization_id()` | **direta** | MÉDIO | Migrar após funções | NÃO |
| RLS em `marketplace_properties` | Migrations | Gate por assinatura ativa | `has_active_subscription()`, `can_access_marketplace()` | **direta** | MÉDIO | Depende de subscription_plans | NÃO |
| RLS em `ad_leads` | Migrations | Requer role manager+ | `is_org_manager_or_above()` | **adaptação** | ALTO | Verificar função sem org_id filter | **SIM** |
| RLS em `organization_invites` | Migrations | Anon pode ler invites pendentes | nenhuma | **direta** | MÉDIO | Confirmar UUIDs fortes como IDs | NÃO |
| RLS em `storage.objects` (property-images) | Migrations | Sem isolamento por org | — | **revisão manual** | ALTO | Reescrever policies para incluir org_id no path | **SIM** |
| RLS em `storage.objects` (lead-documents) | Migrations | Sem isolamento por org | — | **revisão manual** | ALTO | Reescrever policies | **SIM** |
| RLS em `scrape_cache` | Migrations | Compartilhado entre orgs | — | **direta** | BAIXO | Comportamento intencional | NÃO |

---

## SEÇÃO 2: AUTENTICAÇÃO

| Componente | Localização | Função no Sistema | Dependências | Tipo Migração | Risco | Ação Recomendada | Revisão Humana |
|-----------|------------|-------------------|-------------|--------------|-------|-----------------|---------------|
| Configuração do client Supabase | `src/integrations/supabase/client.ts` | Singleton para todas as queries | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | **adaptação** | CRÍTICO | Atualizar URLs e chaves para nova instância | **SIM** |
| AuthContext | `src/contexts/AuthContext.tsx` | Estado global de auth, profile, trial | `profiles`, `organizations` | **direta** | MÉDIO | Migrar código; atualizar env vars | NÃO |
| ProtectedRoute | `src/components/ProtectedRoute.tsx` | Guards de rota frontend | `useAuth()` | **direta** | BAIXO | Migrar sem alteração | NÃO |
| JWT em localStorage | Configuração do client | Persistência de sessão | `auth.sessions` do Supabase | **direta** | MÉDIO | Comportamento padrão do SDK; manter | NÃO |
| Auto-refresh de tokens | Configuração do client | Renovação automática de JWT | SDK interno | **direta** | BAIXO | Comportamento padrão | NÃO |
| Tipos TypeScript do schema | `src/integrations/supabase/types.ts` | Tipos gerados do banco | Todas as tabelas | **revisão manual** | MÉDIO | Regenerar via `supabase gen types` após migração | **SIM** |

---

## SEÇÃO 3: EDGE FUNCTIONS

### 3.1 Funções de Alto Risco (Revisão Manual Obrigatória)

| Componente | Localização | Função no Sistema | Dependências | Tipo Migração | Risco | Ação Recomendada | Revisão Humana |
|-----------|------------|-------------------|-------------|--------------|-------|-----------------|---------------|
| `billing` | `supabase/functions/billing/` | Gestão de assinaturas Asaas | ASAAS_API_KEY, subscriptions table | **alto risco** | CRÍTICO | Testar em sandbox antes de produção; atualizar CORS | **SIM** |
| `billing-webhook` | `supabase/functions/billing-webhook/` | Recebe pagamentos do Asaas | ASAAS_WEBHOOK_TOKEN, URL webhook no Asaas | **alto risco** | CRÍTICO | Atualizar URL no painel Asaas após deploy | **SIM** |
| `admin-users` | `supabase/functions/admin-users/` | CRUD usuários com cascade DELETE | 15+ tabelas, token manual | **alto risco** | ALTO | Revisar lógica de decode JWT manual | **SIM** |
| `meta-oauth-callback` | `supabase/functions/meta-oauth-callback/` | OAuth Meta Ads | META_APP_SECRET, redirect URI | **alto risco** | ALTO | Atualizar redirect URI no painel Meta | **SIM** |
| `rd-station-oauth-callback` | `supabase/functions/rd-station-oauth-callback/` | OAuth RD Station | RD_STATION_CLIENT_SECRET, redirect URI | **alto risco** | ALTO | Atualizar redirect URI no painel RD | **SIM** |
| `rd-station-webhook` | `supabase/functions/rd-station-webhook/` | Recebe eventos RD Station | URL webhook no RD | **alto risco** | ALTO | Atualizar URL no painel RD Station | **SIM** |
| `send-push` | `supabase/functions/send-push/` | Push via OneSignal (chamado por trigger) | pg_net, ONESIGNAL_* | **alto risco** | ALTO | Trigger SQL hardcoded; atualizar app_runtime_config | **SIM** |
| `portal-xml-feed` | `supabase/functions/portal-xml-feed/` | XML para portais imobiliários | Feed URLs configuradas nos portais | **alto risco** | ALTO | Portais precisam ser atualizados manualmente | **SIM** |
| `imobzi-import` / `imobzi-process` | `supabase/functions/imobzi-*/` | Importação de imóveis | API key no DB, Cloudinary | **revisão manual** | ALTO | Verificar dados de `imobzi_settings` migrados | **SIM** |

### 3.2 Funções de Médio Risco

| Componente | Localização | Função no Sistema | Dependências | Tipo Migração | Risco | Ação Recomendada | Revisão Humana |
|-----------|------------|-------------------|-------------|--------------|-------|-----------------|---------------|
| `r2-presign` / `r2-upload` | `supabase/functions/r2-*/` | Upload de imagens para R2 | R2_* env vars | **adaptação** | MÉDIO | Confirmar buckets e credenciais | NÃO |
| `notifications-register-device` | `supabase/functions/` | Registro de dispositivo push | OneSignal, user_devices | **adaptação** | MÉDIO | Testar registro de novo device | NÃO |
| `send-invite-email` / `send-reset-email` | `supabase/functions/` | Emails via Resend | RESEND_API_KEY, domínio DNS | **adaptação** | MÉDIO | Confirmar domínio `portadocorretor.com.br` no Resend | **SIM** |
| `platform-signup` | `supabase/functions/` | Cadastro de nova org | trigger `on_auth_user_created` | **adaptação** | MÉDIO | Confirmar trigger ativo | NÃO |
| `contract-ai-fill` / `generate-*` | `supabase/functions/` | Funcionalidades IA | `LOVABLE_API_KEY` | **revisão manual** | MÉDIO | Verificar se LOVABLE_API_KEY é portável | **SIM** |
| `cleanup-orphan-media` | `supabase/functions/` | Limpeza de mídia órfã | Cloudinary + R2 credentials | **revisão manual** | MÉDIO | Não executar em produção sem teste | **SIM** |

### 3.3 Funções de Baixo Risco (Migração Direta)

| Componente | Tipo Migração | Ação |
|-----------|--------------|------|
| `cloudinary-sign` | direta | Deploy + configurar secrets |
| `cloudinary-image-proxy` | direta | Deploy |
| `drive-image-proxy` | direta | Deploy |
| `onesignal-app-id` | direta | Deploy + configurar secret |
| `geocode-properties` | direta | Deploy |
| `verify-creci` | direta | Deploy |
| `ticket-chat` | direta | Deploy |
| `video-job-status` / `cancel-video-job` | direta | Deploy |
| `storage-metrics` | direta | Deploy |
| `meta-app-id` / `rd-station-app-id` | direta | Deploy + configurar secrets |
| `generate-landing-content` | direta | Deploy + Groq keys |
| `extract-property-pdf` | direta | Deploy + Google AI keys |
| `test-ai-connection` | direta | Deploy |
| `export-database` | direta | Deploy |
| `notifications-test` | direta | Deploy |
| `meta-sync-leads` / `meta-sync-entities` | direta | Deploy |
| `rd-station-stats` / `rd-station-list-contacts` | direta | Deploy |
| `crm-import-leads` | direta | Deploy |
| `validate-document` | direta | Deploy |
| `toggle-maintenance-mode` | direta | Deploy |
| `summarize-lead` | direta | Deploy + LOVABLE_API_KEY |
| `analyze-photo-quality` | direta | Deploy + LOVABLE_API_KEY |
| `accept-invite` | direta | Deploy |
| `manage-member` | direta | Deploy |
| `cloudflare-purge-cache` | direta | Deploy + CF credentials |
| `ai-billing-stripe` | direta | Deploy + STRIPE key |
| `admin-subscriptions` | direta | Deploy |

---

## SEÇÃO 4: STORAGE

| Componente | Localização | Função no Sistema | Dependências | Tipo Migração | Risco | Ação Recomendada | Revisão Humana |
|-----------|------------|-------------------|-------------|--------------|-------|-----------------|---------------|
| Cloudflare R2 (primário) | Edge functions + frontend | Armazenamento de imagens de imóveis | R2_* env vars, VITE_R2_PUBLIC_URL | **adaptação** | MÉDIO | Confirmar buckets e CDN configurados antes do deploy | NÃO |
| Cloudinary (fallback) | Edge functions + frontend | Armazenamento legado de imagens | CLOUDINARY_* env vars | **direta** | MÉDIO | Credenciais devem funcionar igual | NÃO |
| URLs de imagens existentes | `property_media` table | Links para imagens no R2/Cloudinary | `r2_key_full`, `r2_key_thumb`, `cloudinary_url` | **direta** | BAIXO | Dados migrados junto com DB | NÃO |
| Bucket `brand-assets` | Supabase Storage | Logos e assets de org | `VITE_SUPABASE_URL` | **adaptação** | BAIXO | Recriar bucket na nova instância | NÃO |
| Bucket `lead-documents` | Supabase Storage | PDFs de leads | `VITE_SUPABASE_URL` | **revisão manual** | ALTO | Recriar bucket + corrigir RLS policies | **SIM** |
| Bucket `property-images` | Supabase Storage (legado) | Imagens legadas | RLS permissivo | **revisão manual** | ALTO | Corrigir policies antes de migrar dados | **SIM** |
| Service Worker + PWA assets | `public/push/onesignal/` | Push notification service worker | OneSignal SDK paths | **direta** | BAIXO | Deploy junto com frontend | NÃO |

---

## SEÇÃO 5: INTEGRAÇÕES EXTERNAS

| Componente | Localização | Função no Sistema | Dependências | Tipo Migração | Risco | Ação Recomendada | Revisão Humana |
|-----------|------------|-------------------|-------------|--------------|-------|-----------------|---------------|
| Asaas (billing) | `billing` function | Pagamentos PIX/Boleto/Cartão | ASAAS_API_KEY, webhook URL | **alto risco** | CRÍTICO | Atualizar webhook URL no painel Asaas | **SIM** |
| OneSignal (push) | SDK + functions | Push notifications | ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY | **adaptação** | MÉDIO | Atualizar origem permitida no painel OneSignal | NÃO |
| Resend (email) | send-* functions | Emails transacionais | RESEND_API_KEY, domínio DNS | **adaptação** | MÉDIO | Confirmar DNS `portadocorretor.com.br` | **SIM** |
| Meta Ads (OAuth) | meta-* functions | Sync de leads e anúncios | META_APP_SECRET, redirect URI | **alto risco** | ALTO | Atualizar redirect URI no painel Meta | **SIM** |
| RD Station (OAuth) | rd-station-* functions | Sync CRM | RD_STATION_CLIENT_SECRET, redirect URI, webhook URL | **alto risco** | ALTO | Atualizar URIs e webhook no painel RD | **SIM** |
| Imobzi | imobzi-* functions | Importação de imóveis | API key no DB | **adaptação** | MÉDIO | Dados em `imobzi_settings` migrados com DB | NÃO |
| Portais XML (ZAP, Vivareal, etc.) | portal-xml-feed | Feeds de imóveis | Feed URLs nos portais | **alto risco** | ALTO | Atualizar manualmente em cada portal | **SIM** |
| Microsoft Clarity | `src/lib/clarity.ts` | Analytics | Project ID hardcoded | **direta** | BAIXO | Nenhuma ação necessária | NÃO |
| ViaCEP | `src/lib/viaCep.ts` | Busca de CEP | API pública | **direta** | BAIXO | Nenhuma ação necessária | NÃO |
| Google Maps Embed | Frontend | Visualização de mapas | VITE_GOOGLE_MAPS_EMBED_KEY | **adaptação** | BAIXO | Atualizar domínio autorizado no Google Console | NÃO |
| Lovable AI (`LOVABLE_API_KEY`) | generate-* functions | Funcionalidades IA | API proprietária Lovable | **alto risco** | CRÍTICO | Verificar se API é portável fora do Lovable Cloud | **SIM** |

---

## SEÇÃO 6: FRONTEND

| Componente | Localização | Função no Sistema | Dependências | Tipo Migração | Risco | Ação Recomendada | Revisão Humana |
|-----------|------------|-------------------|-------------|--------------|-------|-----------------|---------------|
| Build frontend | `vite.config.ts` | Compilação e PWA | Env vars VITE_* | **adaptação** | MÉDIO | Atualizar `.env` com novas URLs e chaves | NÃO |
| Tipos gerados do schema | `src/integrations/supabase/types.ts` | Type safety em queries | Schema do banco | **revisão manual** | MÉDIO | Executar `supabase gen types typescript` após migração | **SIM** |
| URLs hardcoded no frontend | vários arquivos | Chamadas a edge functions | `VITE_SUPABASE_URL` | **adaptação** | MÉDIO | Verificar se todas usam env vars (não há URLs hardcoded identificadas) | NÃO |
| PWA manifest | `vite.config.ts` | App instalável | URLs de icons, start_url | **direta** | BAIXO | Atualizar domínio se mudar | NÃO |
| OneSignal Service Worker | `public/push/onesignal/` | Push notification worker | SDK paths | **direta** | BAIXO | Manter paths iguais | NÃO |

---

## SEÇÃO 7: CONFIGURAÇÃO E INFRA

| Componente | Localização | Função no Sistema | Dependências | Tipo Migração | Risco | Ação Recomendada | Revisão Humana |
|-----------|------------|-------------------|-------------|--------------|-------|-----------------|---------------|
| `supabase/config.toml` | Raiz do projeto | Config das edge functions (JWT policies) | Nomes das 71 funções | **adaptação** | MÉDIO | Atualizar project_id para nova instância | NÃO |
| URL hardcoded no trigger | Migration | Fallback URL para send-push | `app_runtime_config` | **revisão manual** | ALTO | Executar UPDATE em `app_runtime_config` após migração | **SIM** |
| Todos os secrets Supabase | Painel Supabase | Credenciais de serviços externos | 25+ secrets | **revisão manual** | CRÍTICO | Configurar todos os secrets na nova instância antes do deploy | **SIM** |
| CORS (`APP_ALLOWED_ORIGINS`) | `billing` function | Controle de origem | Domínio do app | **adaptação** | MÉDIO | Atualizar com novos domínios | NÃO |
| Cron jobs (se existirem) | Supabase cron | Sincronizações automáticas | URLs das functions | **revisão manual** | MÉDIO | Verificar e reconfigurar cron schedules | **SIM** |

---

## RESUMO QUANTITATIVO

| Tipo de Migração | Quantidade |
|-----------------|-----------|
| **Migração direta** | ~45 componentes |
| **Adaptação necessária** | ~20 componentes |
| **Revisão manual obrigatória** | ~25 componentes |
| **Alto risco** | ~12 componentes |

| Risco | Quantidade |
|-------|-----------|
| **CRÍTICO** | 6 |
| **ALTO** | 22 |
| **MÉDIO** | 35 |
| **BAIXO** | 20+ |

| Requer revisão humana | Quantidade |
|----------------------|-----------|
| **SIM** | 28 |
| **NÃO** | 50+ |

---

## ORDEM RECOMENDADA DE MIGRAÇÃO

### Fase 0: Pré-migração (humano obrigatório)
1. Confirmar email do admin (`admin_allowlist`)
2. Confirmar todos os secrets disponíveis
3. Verificar disponibilidade de `pg_net` na nova instância
4. Preparar script de atualização de `app_runtime_config`

### Fase 1: Database
1. Executar migrations (ordem já correta nos arquivos timestamp)
2. Verificar funções SECURITY DEFINER criadas
3. Verificar RLS habilitada em todas as tabelas
4. Executar seed data crítico
5. Configurar trigger `on_auth_user_created`
6. Atualizar `app_runtime_config.supabase_url`

### Fase 2: Secrets e Configuração
1. Configurar todos os 25+ secrets no novo projeto
2. Atualizar `supabase/config.toml` com novo project_id
3. Atualizar `.env` com novas `VITE_*` URLs

### Fase 3: Edge Functions
1. Deploy de todas as 71 funções
2. Testar functions críticas (billing em sandbox, send-push, auth)
3. Verificar CORS nas funções com allowlist

### Fase 4: Integrações Externas
1. Atualizar webhook URL no Asaas
2. Atualizar redirect URI no Meta
3. Atualizar redirect URI e webhook no RD Station
4. Atualizar feeds nos portais imobiliários (ZAP, Viva Real, etc.)
5. Verificar domínio no Resend

### Fase 5: Frontend
1. Build com novas env vars
2. Regenerar `types.ts` via `supabase gen types typescript`
3. Deploy e testes E2E

### Fase 6: Validação
1. Testar fluxo completo de signup
2. Testar billing (sandbox)
3. Testar push notification
4. Verificar isolamento multi-tenant (query com duas orgs diferentes)

---

*Matriz gerada por análise estática — nenhuma alteração foi feita no repositório.*

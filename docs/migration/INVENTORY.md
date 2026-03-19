# INVENTORY.md — Habitae ERP Imobiliário
## Diagnóstico Completo do Projeto (Lovable Cloud)
> Gerado em: 2026-03-19 | Projeto: aiflfkkjitvsyszwdfga

---

## 1. BANCO DE DADOS

### 1.1 Tabelas (88 tabelas no schema `public`)

| # | Tabela | RLS | Tamanho (bytes) | Rows Est. |
|---|--------|-----|-----------------|-----------|
| 1 | activity_log | ✅ | 2.973.696 | ~1+ |
| 2 | ad_accounts | ✅ | — | 0 |
| 3 | ad_entities | ✅ | 172.032 | 0 |
| 4 | ad_insights_daily | ✅ | 172.032 | 0 |
| 5 | ad_leads | ✅ | 204.800 | 0 |
| 6 | ad_settings | ✅ | — | 0 |
| 7 | admin_allowlist | ✅ | — | 0 |
| 8 | ai_billing_config | ✅ | — | 0 |
| 9 | ai_billing_invoices | ✅ | — | 0 |
| 10 | ai_billing_pricing | ✅ | — | 0 |
| 11 | ai_provider_config | ✅ | — | 0 |
| 12 | ai_token_usage_events | ✅ | — | 0 |
| 13 | ai_usage_logs | ✅ | — | 0 |
| 14 | anuncios_gerados | ✅ | — | 0 |
| 15 | app_runtime_config | ✅ | — | 0 |
| 16 | appointments | ✅ | — | 0 |
| 17 | audit_events | ✅ | 540.672 | ~1+ |
| 18 | audit_logs | ✅ | 131.072 | 0 |
| 19 | billing_payments | ✅ | — | 0 |
| 20 | billing_webhook_logs | ✅ | — | 0 |
| 21 | brand_settings | ✅ | — | 0 |
| 22 | city_codes | ✅ | — | 0 |
| 23 | commissions | ✅ | — | 0 |
| 24 | consumer_favorites | ✅ | — | 0 |
| 25 | contract_documents | ✅ | — | 0 |
| 26 | contract_templates | ✅ | — | 0 |
| 27 | contracts | ✅ | — | 0 |
| 28 | crm_import_logs | ✅ | — | 0 |
| 29 | deleted_property_media | ✅ | — | 0 |
| 30 | generated_arts | ✅ | — | 0 |
| 31 | generated_videos | ✅ | — | 0 |
| 32 | imobzi_api_keys | ✅ | — | 0 |
| 33 | imobzi_settings | ✅ | — | 0 |
| 34 | import_run_items | ✅ | 614.400 | 0 |
| 35 | import_runs | ✅ | 278.528 | 0 |
| 36 | import_tokens | ✅ | — | 0 |
| 37 | invoices | ✅ | — | 0 |
| 38 | lead_document_template_items | ✅ | — | 0 |
| 39 | lead_document_templates | ✅ | — | 0 |
| 40 | lead_documents | ✅ | — | 0 |
| 41 | lead_interactions | ✅ | 155.648 | 0 |
| 42 | lead_score_events | ✅ | 131.072 | 0 |
| 43 | lead_stages | ✅ | — | 0 |
| 44 | lead_types | ✅ | — | 0 |
| 45 | leads | ✅ | 999.424 | ~1+ |
| 46 | maintenance_audit_log | ✅ | — | ~1+ |
| 47 | marketplace_contact_access | ✅ | — | 0 |
| 48 | marketplace_properties | ✅ | 2.441.216 | 0 |
| 49 | notifications | ✅ | 1.138.688 | ~2+ |
| 50 | organization_custom_roles | ✅ | — | 0 |
| 51 | organization_invites | ✅ | — | 0 |
| 52 | organization_member_events | ✅ | — | 0 |
| 53 | organizations | ✅ | — | 0 |
| 54 | owner_aliases | ✅ | — | 0 |
| 55 | owners | ✅ | 204.800 | 0 |
| 56 | platform_invites | ✅ | — | 0 |
| 57 | portal_feed_logs | ✅ | — | 0 |
| 58 | portal_feeds | ✅ | — | 0 |
| 59 | profiles | ✅ | — | 0 |
| 60 | properties | ✅ | 16.465.920 | 0 |
| 61 | property_images | ✅ | 11.698.176 | 0 |
| 62 | property_landing_content | ✅ | 335.872 | 0 |
| 63 | property_landing_overrides | ✅ | — | 0 |
| 64 | property_media | ✅ | — | 0 |
| 65 | property_owners | ✅ | 786.432 | 0 |
| 66 | property_partnerships | ✅ | — | 0 |
| 67 | property_share_links | ✅ | — | 0 |
| 68 | property_status_history | ✅ | — | 0 |
| 69 | property_type_codes | ✅ | — | 0 |
| 70 | property_types | ✅ | — | 0 |
| 71 | property_visibility | ✅ | — | 0 |
| 72 | property_visits | ✅ | — | 0 |
| 73 | push_subscriptions | ✅ | — | 0 |
| 74 | rd_station_settings | ✅ | — | 0 |
| 75 | rd_station_webhook_logs | ✅ | 12.681.216 | ~1+ |
| 76 | saved_searches | ✅ | — | 0 |
| 77 | scrape_cache | ✅ | — | 0 |
| 78 | subscription_plans | ✅ | — | 0 |
| 79 | subscriptions | ✅ | — | 0 |
| 80 | support_tickets | ✅ | — | 0 |
| 81 | tasks | ✅ | — | 0 |
| 82 | ticket_messages | ✅ | — | 0 |
| 83 | transaction_categories | ✅ | — | 0 |
| 84 | transactions | ✅ | — | 0 |
| 85 | user_devices | ✅ | 122.880 | 0 |
| 86 | user_roles | ✅ | — | 0 |
| 87 | verification_codes | ✅ | — | 0 |
| 88 | whatsapp_instances | ✅ | — | 0 |
| 89 | zone_codes | ✅ | — | 0 |

**Nota:** Todas as 89 tabelas possuem RLS habilitado ✅

### 1.2 Views (2)

| View | Descrição |
|------|-----------|
| `profiles_public` | Projeção segura de profiles (sem dados sensíveis) |
| `marketplace_properties_public` | Projeção pública de marketplace_properties |

### 1.3 Enums (24)

| Enum | Valores |
|------|---------|
| `ad_entity_type` | campaign, adset, ad |
| `ad_lead_status` | new, read, sent_to_crm, send_failed, archived |
| `ad_provider` | meta, google |
| `app_role` | admin, corretor, assistente, developer, leader, sub_admin |
| `billing_cycle` | monthly, yearly |
| `commission_type` | valor, percentual |
| `contract_status` | rascunho, ativo, encerrado, cancelado |
| `contract_type` | venda, locacao |
| `financial_transaction_type` | receita, despesa |
| `interaction_type` | ligacao, email, visita, whatsapp, reuniao, nota |
| `invite_status` | pending, accepted, expired, cancelled |
| `invoice_status` | pendente, pago, atrasado, cancelado |
| `launch_stage` | nenhum, em_construcao, pronto, futuro |
| `lead_stage` | novo, contato, visita, proposta, negociacao, fechado_ganho, fechado_perdido |
| `organization_type` | imobiliaria, corretor_individual |
| `partnership_status` | pending, active, rejected, expired |
| `property_condition` | novo, usado |
| `property_image_type` | photo, floor_plan, floor_plan_secondary |
| `property_status` | disponivel, reservado, vendido, alugado, inativo, com_proposta, suspenso |
| `property_visibility_type` | private, partners_only, public |
| `subscription_status` | trial, active, cancelled, suspended, expired, overdue, pending |
| `transaction_type` | venda, aluguel, ambos |
| `visit_status` | scheduled, confirmed, completed, cancelled, no_show |

### 1.4 Extensões Ativas (9)

| Extensão | Versão | Nota para Migração |
|----------|--------|---------------------|
| `plpgsql` | 1.0 | Padrão |
| `uuid-ossp` | 1.1 | Padrão Supabase |
| `pgcrypto` | 1.3 | Padrão Supabase |
| `pg_cron` | 1.6.4 | ⚠️ Requer ativação manual |
| `pg_net` | 0.19.5 | ⚠️ Requer ativação manual |
| `pg_graphql` | 1.5.11 | Auto no Supabase hosted |
| `pg_stat_statements` | 1.11 | Padrão |
| `pg_trgm` | 1.6 | Ativar manualmente |
| `supabase_vault` | 0.3.1 | Auto no Supabase hosted |

### 1.5 Jobs pg_cron (2)

| Job ID | Schedule | Função |
|--------|----------|--------|
| 1 | `0 */6 * * *` (6h em 6h) | `cleanup-orphan-media` — Limpa mídias órfãs |
| 2 | `*/15 * * * *` (15 em 15 min) | `rd-station-sync-leads` — Sincroniza leads do RD Station |

⚠️ **AMBOS contêm URLs hardcoded** (`https://aiflfkkjitvsyszwdfga.supabase.co`) e anon key do projeto atual. **Devem ser recriados** no novo projeto.

### 1.6 Triggers com pg_net (1)

| Trigger | Tabela | Função |
|---------|--------|--------|
| `on_notification_send_push` | `notifications` | `trigger_push_on_notification()` |

⚠️ Esta função usa `net.http_post()` para chamar a Edge Function `send-push`. Contém fallback hardcoded para URL/anon key do projeto atual. **Deve ter GUC settings configurados** (`app.settings.supabase_url`, `app.settings.supabase_anon_key`) no novo projeto.

### 1.7 FKs para auth.users (20 tabelas públicas)

| Tabela | Constraint | Coluna |
|--------|-----------|--------|
| ai_provider_config | updated_by_fkey | updated_by |
| appointments | assigned_to_fkey, created_by_fkey | assigned_to, created_by |
| commissions | broker_id_fkey | broker_id |
| contract_documents | uploaded_by_fkey | uploaded_by |
| contracts | created_by_fkey, broker_id_fkey | created_by, broker_id |
| invoices | created_by_fkey | created_by |
| lead_interactions | created_by_fkey | created_by |
| leads | created_by_fkey, broker_id_fkey | created_by, broker_id |
| organization_invites | invited_by_fkey | invited_by |
| organizations | created_by_fkey | created_by |
| platform_invites | created_by_fkey | created_by |
| profiles | user_id_fkey | user_id |
| properties | created_by_fkey, captador_id_fkey | created_by, captador_id |
| property_share_links | broker_id_fkey | broker_id |
| tasks | created_by_fkey, assigned_to_fkey | created_by, assigned_to |
| transactions | created_by_fkey | created_by |
| user_roles | user_id_fkey | user_id |
| verification_codes | user_id_fkey | user_id |

⚠️ **Crítico**: auth.users deve ser migrado ANTES dos dados dessas tabelas.

### 1.8 Funções SQL (~70+)

**Funções de Negócio:**
- `fn_dashboard_stats`, `fn_kpi_metrics`, `fn_agent_ranking`, `fn_funnel_detail`, `fn_pipeline_summary`
- `insert_notification`, `insert_audit_event`
- `recalculate_lead_score`, `auto_generate_property_code`, `auto_set_org_slug`
- `generate_property_code`, `create_default_document_templates`, `create_trial_subscription`
- `slugify`, `get_current_user_role`

**Funções de Acesso/RBAC:**
- `has_role`, `is_org_admin`, `is_org_manager_or_above`, `is_system_admin`, `current_user_has_role`
- `is_maintenance_blocked`, `get_user_organization_id`
- `can_access_marketplace`, `can_access_partnerships`

**Funções de Schema Export:**
- `get_schema_enums`, `get_schema_tables_ddl`, `get_schema_fk_constraints`
- `get_schema_functions`, `get_schema_triggers`, `get_schema_policies`
- `get_schema_indexes`, `get_schema_rls_tables`, `get_schema_column_types`

**Funções Públicas (sem auth):**
- `get_public_property`, `get_public_property_by_slug`, `get_public_property_by_org_code`
- `get_public_property_images`, `get_public_property_media`
- `get_platform_invite`, `get_org_by_invite_code`

**Funções de Trigger:**
- `trigger_push_on_notification` (usa pg_net)
- `log_lead_interaction_activity`, `log_lead_updated`, `log_property_updated`
- `notify_broker_lead_overload`, `notify_unassigned_lead`, `notify_visit_scheduled`
- `audit_lead_changes`, `audit_contract_changes`, `audit_commission_changes`, `audit_property_changes`, `audit_role_changes`
- `capture_media_before_property_delete`, `cascade_delete_marketplace`
- `log_property_availability_change`

---

## 2. EDGE FUNCTIONS (70 funções)

### 2.1 Funções que usam LOVABLE_API_KEY + ai.gateway.lovable.dev (6)

| Função | Modelo Utilizado | Criticidade |
|--------|-----------------|-------------|
| `analyze-photo-quality` | Gemini (vision) | 🔴 Não portável |
| `validate-document` | Gemini (vision) | 🔴 Não portável |
| `contract-ai-fill` | Chat completions | 🔴 Não portável |
| `generate-contract-template` | Chat completions | 🔴 Não portável |
| `generate-ad-image` | gemini-3-pro-image-preview | 🔴 Não portável |
| `generate-ad-content` | google/gemini-3-flash-preview | 🔴 Não portável |

**Ação necessária:** Substituir `ai.gateway.lovable.dev` por APIs diretas (Google AI, OpenAI) e fornecer chaves próprias.

### 2.2 Funções com verify_jwt=false (34)

Listadas em `supabase/config.toml`. Estas são acessíveis sem autenticação JWT e devem ser replicadas no `config.toml` do novo projeto.

### 2.3 Funções que usam SERVICE_ROLE_KEY (46 de 70)

Praticamente todas as Edge Functions usam `SUPABASE_SERVICE_ROLE_KEY`. Isso é **padrão e portável** — basta configurar o secret no novo projeto.

### 2.4 Integrações Externas por Função

| Serviço | Funções | Secrets Necessários |
|---------|---------|---------------------|
| **Meta Ads** | meta-oauth-callback, meta-sync-leads, meta-sync-entities, meta-save-account, meta-app-id | META_APP_ID, META_APP_SECRET |
| **RD Station** | rd-station-*, 6 funções | RD_STATION_CLIENT_ID, RD_STATION_CLIENT_SECRET |
| **Asaas (Billing)** | billing, billing-webhook | ASAAS_API_KEY, ASAAS_SANDBOX, ASAAS_WEBHOOK_TOKEN |
| **Cloudinary** | cloudinary-sign, cloudinary-cleanup, cloudinary-image-proxy, cloudinary-purge | CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (x2) |
| **Cloudflare R2** | r2-presign, r2-upload, migrate-to-r2 | R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT, R2_PUBLIC_URL |
| **OneSignal** | send-push, notifications-register-device, onesignal-app-id | ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY |
| **Resend** | send-invite-email, send-reset-email | RESEND_API_KEY |
| **Imobzi** | imobzi-import, imobzi-list, imobzi-process | IMOBZI_API_KEY |
| **WhatsApp (UAZAPI)** | whatsapp-instance, whatsapp-send | UAZAPI_BASE_URL, UAZAPI_ADMIN_TOKEN |
| **Cloudflare** | cloudflare-purge-cache | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID |
| **Google** | geocode-properties, scrape-drive-photos, cache-drive-image, drive-image-proxy | GOOGLE_DRIVE_API_KEY, VITE_GOOGLE_MAPS_EMBED_KEY |
| **Google AI (direto)** | Vários (via ai_provider_config) | GOOGLE_AI_KEY_1, GOOGLE_AI_KEY_2, GOOGLE_AI_PDF_KEY_1/2 |
| **Groq** | generate-landing-content, etc. | GROQ_API_KEY_1/2, GROQ_LANDING_KEY_1/2 |
| **OpenAI** | generate-ad-image | OPENAI_IMAGE_API_KEY |

---

## 3. SECRETS (40 configurados)

| Secret | Tipo | Portável | Crítico |
|--------|------|----------|---------|
| `LOVABLE_API_KEY` | Gateway AI Lovable | ❌ NÃO | 🔴 |
| `APP_URL` | Config | ✅ | ⚠️ |
| `ASAAS_API_KEY` | Billing | ✅ | ✅ |
| `ASAAS_SANDBOX` | Config | ✅ | ✅ |
| `ASAAS_WEBHOOK_TOKEN` | Billing | ✅ | ✅ |
| `CLOUDFLARE_API_TOKEN` | CDN | ✅ | ⚠️ |
| `CLOUDFLARE_ZONE_ID` | CDN | ✅ | ⚠️ |
| `CLOUDINARY_*` (x6) | Storage | ✅ | ✅ |
| `GOOGLE_AI_KEY_*` (x4) | AI | ✅ | ✅ |
| `GOOGLE_DRIVE_API_KEY` | Import | ✅ | ⚠️ |
| `GROQ_*` (x4) | AI | ✅ | ✅ |
| `IMOBZI_API_KEY` | Import | ✅ | ⚠️ |
| `META_APP_ID` | Ads | ✅ | ⚠️ |
| `META_APP_SECRET` | Ads | ✅ | ⚠️ |
| `ONESIGNAL_*` (x2) | Push | ✅ | ✅ |
| `OPENAI_IMAGE_API_KEY` | AI Image | ✅ | ⚠️ |
| `R2_*` (x5) | Storage | ✅ | ✅ |
| `RD_STATION_*` (x2) | CRM | ✅ | ⚠️ |
| `RESEND_API_KEY` | Email | ✅ | ✅ |
| `UAZAPI_*` (x2) | WhatsApp | ✅ | ⚠️ |
| `VITE_GOOGLE_MAPS_EMBED_KEY` | Maps | ✅ | ⚠️ |
| `VITE_META_APP_ID` | Frontend | ✅ | ⚠️ |

**39/40 são portáveis.** Único não portável: `LOVABLE_API_KEY`.

---

## 4. AUTENTICAÇÃO

- **Provider**: Email/Password (Supabase Auth)
- **auth.users** referenciado por 20 tabelas via FK
- **Hashes de senha**: Disponíveis via `auth.admin.listUsers()` na Edge Function `export-database` (mode=auth). O export inclui `email`, `phone`, `created_at`, `user_metadata`, `app_metadata`, mas **NÃO inclui encrypted_password** por limitação da API admin.
- **⚠️ LIMITAÇÃO CRÍTICA**: Não é possível exportar hashes de senha via API. Usuários precisarão resetar senha no novo ambiente, OU usar `pg_dump` direto na tabela `auth.users` (requer connection string).

---

## 5. MODO MANUTENÇÃO

- **Edge Function**: `toggle-maintenance-mode` ✅ Existe
- **Tabela de controle**: `app_runtime_config` (singleton)
- **Código de ativação**: `MIGRACAO`
- **Senha de desativação**: `12362131`
- **Bloqueio de escrita**: Via policies que chamam `is_maintenance_blocked()` em tabelas críticas (appointments, leads, etc.)
- **Realtime**: Propagação instantânea via canal `maintenance-realtime`
- **Force logout**: Campo `force_logout_at` na tabela de config

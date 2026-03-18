# EDGE FUNCTIONS AUDIT — Habitae1

**Data**: 2026-03-18 | **Total**: 71 funções Deno
**Supabase Project**: `aiflfkkjitvsyszwdfga`

> **Nota importante**: Todas as funções têm `verify_jwt = false` no `config.toml`.
> O controle de autenticação é feito **manualmente dentro do código de cada função**.

---

## LEGENDA

| Campo | Valores possíveis |
|-------|-----------------|
| **Tipo** | Protegida (JWT manual) / Pública (sem auth) / Webhook (assinatura) |
| **Criticidade** | CRÍTICA / ALTA / MÉDIA / BAIXA |
| **Risco Migração** | ALTO / MÉDIO / BAIXO |

---

## UTILITÁRIOS COMPARTILHADOS (`_shared/`)

### `_shared/logger.ts`
- **Propósito**: Logger estruturado JSON com redação automática de PII
- **PII redatada**: `password, token, authorization, secret, api_key, cpf, cnpj, card_number, email, phone`
- **Padrões regex**: CPF (`xxx.xxx.xxx-xx`), CNPJ (`xx.xxx.xxx/xxxx-xx`), emails
- **Risco migração**: BAIXO — utilitário puro, sem dependências externas

### `_shared/ai-billing.ts`
- **Propósito**: Rastreamento de uso de tokens IA com cálculo de custo e markup 30%
- **Providers suportados**: GPT-4o, GPT-4o-mini, Gemini, Claude, Llama, Stable Diffusion, Leonardo
- **Database**: INSERT em `ai_token_usage_events`
- **Comportamento de falha**: Silencioso (nunca propaga erros)
- **Risco migração**: MÉDIO — depende de `ai_billing_pricing` seed data

### `_shared/notification-service.ts`
- **Propósito**: Serviço centralizado de push via OneSignal
- **Secrets**: `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`
- **Database**: `user_devices` (consulta + limpeza)
- **Fallback**: `sendToExternalUserAlias` quando subscription IDs inválidos
- **Risco migração**: MÉDIO — depende de dados de `user_devices` migrados

---

## INVENTÁRIO COMPLETO DAS EDGE FUNCTIONS

### GRUPO 1: ADMIN / PLATAFORMA

---

#### `accept-invite`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Aceita convite de organização via RPC atômica |
| **Auth** | JWT manual via getClaims |
| **HTTP** | POST |
| **DB** | Service Role (RPC) |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` |
| **Criticidade** | ALTA |
| **Risco** | MÉDIO |
| **Recomendação** | Migrar diretamente; verificar RPC `accept_organization_invite` |

---

#### `admin-audit-metrics`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (system admin) |
| **Propósito** | Métricas de auditoria do sistema: orgs, usuários, storage |
| **Auth** | Bearer JWT + verificação `is_system_admin()` |
| **HTTP** | GET |
| **Externas** | Cloudinary Admin API |
| **DB** | Service Role + User Anon |
| **Secrets** | `SUPABASE_*`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `ENVIRONMENT` |
| **Criticidade** | ALTA |
| **Risco** | ALTO |
| **Recomendação** | Validar `is_system_admin()` na nova instância; seed do `admin_allowlist` |

---

#### `admin-subscriptions`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (sem JWT) |
| **Propósito** | Gerencia trial e assinaturas de orgs |
| **Auth** | Verificação manual de token interno |
| **HTTP** | GET, PATCH |
| **DB** | Service Role |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` |
| **Criticidade** | CRÍTICA |
| **Risco** | MÉDIO |
| **Recomendação** | Revisar mecanismo de autenticação (token interno vs JWT) |

---

#### `admin-users`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (sem JWT Supabase, token manual) |
| **Propósito** | CRUD de usuários da plataforma; DELETE cascateia 15+ tabelas |
| **Auth** | Custom token decode manual |
| **HTTP** | GET, PATCH, DELETE |
| **DB** | Service Role |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `APP_ALLOWED_ORIGINS` |
| **Criticidade** | CRÍTICA |
| **Risco** | ALTO |
| **Recomendação** | **Revisão humana obrigatória** — operação destrutiva irreversível; verificar lógica de decode manual |

---

#### `manage-member`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Remove membros e reatribui leads da org |
| **Auth** | JWT getClaims + verificação admin |
| **HTTP** | POST |
| **DB** | Service Role |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` |
| **Criticidade** | ALTA |
| **Risco** | MÉDIO |
| **Recomendação** | Migração direta; verificar queries de reatribuição |

---

#### `platform-signup`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (sem auth) |
| **Propósito** | Cadastro inicial de nova organização na plataforma |
| **Auth** | Nenhuma |
| **HTTP** | POST |
| **DB** | Service Role |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Criticidade** | CRÍTICA |
| **Risco** | MÉDIO |
| **Recomendação** | Migração direta; confirmar trigger `on_auth_user_created` ativo |

---

#### `toggle-maintenance-mode`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (token de admin) |
| **Propósito** | Ativa/desativa modo manutenção via `app_runtime_config` |
| **Auth** | Token interno |
| **HTTP** | POST |
| **DB** | Service Role |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Criticidade** | MÉDIA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `export-database`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (system admin) |
| **Propósito** | Exporta schema, dados e auth como CSV/JSON |
| **Auth** | Bearer JWT + `is_system_admin()` |
| **HTTP** | POST |
| **DB** | Service Role |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Criticidade** | ALTA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

### GRUPO 2: BILLING

---

#### `billing`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | CRUD completo de assinaturas via Asaas (PIX, Cartão, Boleto) |
| **Auth** | JWT getClaims |
| **HTTP** | POST |
| **Externas** | Asaas API (sandbox ou produção) |
| **DB** | Service Role |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ASAAS_API_KEY`, `ASAAS_SANDBOX`, `APP_ALLOWED_ORIGINS` |
| **Criticidade** | CRÍTICA |
| **Risco** | ALTO |
| **Recomendação** | **Revisão humana obrigatória** — envolve dinheiro real; confirmar ambiente sandbox vs prod; CORS deve ser atualizado |

---

#### `billing-webhook`
| Campo | Valor |
|-------|-------|
| **Tipo** | Webhook (assinatura Asaas) |
| **Propósito** | Recebe eventos de pagamento do Asaas e atualiza status |
| **Auth** | Header `asaas-access-token` comparado a `ASAAS_WEBHOOK_TOKEN` |
| **HTTP** | POST |
| **Externas** | Recebido do Asaas |
| **DB** | Service Role |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_WEBHOOK_TOKEN` |
| **Criticidade** | CRÍTICA |
| **Risco** | ALTO |
| **Recomendação** | **URL do webhook precisa ser atualizada no painel Asaas** após migração |

---

#### `ai-billing-stripe`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Envia meter events de IA para Stripe |
| **Auth** | JWT getClaims |
| **HTTP** | POST |
| **Externas** | Stripe API (modo test) |
| **DB** | Service Role |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `STRIPE_TEST_SECRET_KEY` |
| **Criticidade** | ALTA |
| **Risco** | MÉDIO |
| **Recomendação** | Em modo test atualmente; migração direta |

---

### GRUPO 3: STORAGE

---

#### `r2-presign`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Gera URLs presignadas para upload direto ao R2 |
| **Auth** | JWT getClaims + verificação de ownership da property |
| **HTTP** | POST |
| **Externas** | Cloudflare R2 (AWS SigV4) |
| **DB** | Service Role + User Anon |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` |
| **Criticidade** | CRÍTICA |
| **Risco** | MÉDIO |
| **Recomendação** | Migração direta; confirmar que `VITE_R2_PUBLIC_URL` e `R2_PUBLIC_URL` apontam para o mesmo CDN |

---

#### `r2-upload`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Upload de imagens para R2 com geração de variantes |
| **Auth** | JWT getClaims |
| **Externas** | Cloudflare R2 |
| **Secrets** | Mesmos do r2-presign |
| **Criticidade** | CRÍTICA |
| **Risco** | MÉDIO |
| **Recomendação** | Migração direta |

---

#### `cloudinary-sign`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Assina uploads para Cloudinary com deduplicação por hash |
| **Auth** | JWT getClaims |
| **Externas** | Cloudinary |
| **Secrets** | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| **Criticidade** | ALTA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `cloudinary-image-proxy`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (sem auth) |
| **Propósito** | Proxy para imagens Cloudinary (evita CORS/401) |
| **Auth** | Nenhuma |
| **HTTP** | GET |
| **Externas** | Cloudinary CDN |
| **Secrets** | Nenhum |
| **Criticidade** | MÉDIA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `cleanup-orphan-media`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (JWT ou cron) |
| **Propósito** | Remove mídia órfã do Cloudinary e R2 |
| **Auth** | JWT getClaims ou cron token |
| **Externas** | Cloudinary Admin API, Cloudflare R2 |
| **Secrets** | `SUPABASE_*`, todos `CLOUDINARY_*`, todos `R2_*` |
| **Criticidade** | ALTA |
| **Risco** | ALTO |
| **Recomendação** | **Atenção**: operação destrutiva; verificar lógica de "órfão" antes de executar na nova instância |

---

#### `migrate-to-r2` / `migrate-cloudinary-to-r2`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (token interno) |
| **Propósito** | Migra assets do Cloudinary para R2 |
| **Auth** | Token interno |
| **Externas** | Cloudinary, R2 |
| **Criticidade** | ALTA |
| **Risco** | ALTO |
| **Recomendação** | Provavelmente não necessária após migração; arquivar |

---

#### `cloudflare-purge-cache`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Purga cache do Cloudflare para URLs de imagem |
| **Externas** | Cloudflare API |
| **Secrets** | `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN` |
| **Criticidade** | BAIXA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `storage-metrics`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Métricas de uso de storage por org |
| **Auth** | JWT getClaims |
| **DB** | Service Role |
| **Criticidade** | BAIXA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

### GRUPO 4: NOTIFICAÇÕES

---

#### `send-push`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (chamada via DB trigger) |
| **Propósito** | Dispara push notification via OneSignal quando notificação é inserida no DB |
| **Auth** | Chamada interna (trigger) |
| **Externas** | OneSignal API |
| **DB** | Service Role |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` |
| **Criticidade** | ALTA |
| **Risco** | ALTO |
| **Recomendação** | **URL hardcoded no trigger** — atualizar `app_runtime_config` após migração |

---

#### `notifications-register-device`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Registra dispositivo OneSignal no `user_devices` |
| **Auth** | JWT getClaims |
| **Externas** | OneSignal (opcional, validação) |
| **DB** | Service Role |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ONESIGNAL_APP_ID` |
| **Criticidade** | ALTA |
| **Risco** | MÉDIO |
| **Recomendação** | Migração direta |

---

#### `send-invite-email`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (token Bearer interno) |
| **Propósito** | Envia email de convite (plataforma ou equipe) via Resend |
| **Auth** | Bearer token (interno, não é JWT de usuário) |
| **Externas** | Resend API |
| **Secrets** | `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| **Criticidade** | ALTA |
| **Risco** | MÉDIO |
| **Recomendação** | Confirmar domínio de email `portadocorretor.com.br` configurado no Resend |

---

#### `send-reset-email`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (token Bearer interno) |
| **Propósito** | Envia email de reset de senha via Resend |
| **Auth** | Bearer token interno |
| **Externas** | Resend API |
| **Secrets** | `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Criticidade** | ALTA |
| **Risco** | MÉDIO |
| **Recomendação** | Confirmar URL de reset apontando para nova instância |

---

#### `onesignal-app-id`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (sem auth) |
| **Propósito** | Retorna o App ID do OneSignal para o frontend |
| **Auth** | Nenhuma |
| **HTTP** | GET |
| **Secrets** | `ONESIGNAL_APP_ID` |
| **Criticidade** | MÉDIA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `notifications-test`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Envia push de teste para usuário atual |
| **Auth** | JWT getClaims |
| **Externas** | OneSignal |
| **Criticidade** | BAIXA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

### GRUPO 5: META ADS

---

#### `meta-oauth-callback`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (OAuth callback) |
| **Propósito** | Completa OAuth do Meta, armazena token longo em `ad_accounts` |
| **Auth** | Valida `state` com org_id interno |
| **HTTP** | GET |
| **Externas** | Meta Graph API |
| **Secrets** | `META_APP_ID`, `META_APP_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` |
| **Criticidade** | ALTA |
| **Risco** | ALTO |
| **Recomendação** | **Atualizar URI de redirect no painel Meta** após migração; URL do app muda |

---

#### `meta-app-id`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (sem auth) |
| **Propósito** | Retorna Meta App ID para iniciar OAuth no frontend |
| **Auth** | Nenhuma |
| **Secrets** | `META_APP_ID` |
| **Criticidade** | MÉDIA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `meta-save-account`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (token de estado) |
| **Propósito** | Salva payload de autenticação de conta de anúncio |
| **Auth** | Valida state do OAuth |
| **Externas** | Meta Graph API |
| **Secrets** | `META_APP_SECRET`, `SUPABASE_*` |
| **Criticidade** | MÉDIA |
| **Risco** | MÉDIO |
| **Recomendação** | Migração direta |

---

#### `meta-sync-leads`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (cron ou webhook) |
| **Propósito** | Sincroniza leads do Meta Ads para CRM |
| **Auth** | Token interno / cron |
| **Externas** | Meta Graph API |
| **DB** | Service Role |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Criticidade** | ALTA |
| **Risco** | MÉDIO |
| **Recomendação** | Migração direta; verificar cron schedule |

---

#### `meta-sync-entities`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (cron) |
| **Propósito** | Sincroniza contas e campanhas do Meta |
| **Auth** | Token interno / cron |
| **Externas** | Meta Graph API |
| **DB** | Service Role |
| **Criticidade** | MÉDIA |
| **Risco** | MÉDIO |
| **Recomendação** | Migração direta |

---

### GRUPO 6: RD STATION

---

#### `rd-station-oauth-callback`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (OAuth callback) |
| **Propósito** | Completa OAuth do RD Station, salva tokens em `rd_station_settings` |
| **Auth** | Valida state interno |
| **HTTP** | GET |
| **Externas** | RD Station API |
| **Secrets** | `RD_STATION_CLIENT_ID`, `RD_STATION_CLIENT_SECRET`, `SUPABASE_*`, `APP_URL` |
| **Criticidade** | ALTA |
| **Risco** | ALTO |
| **Recomendação** | **Atualizar URI de redirect no painel RD Station** após migração |

---

#### `rd-station-app-id`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (sem auth) |
| **Propósito** | Retorna ClientId do RD Station para iniciar OAuth |
| **Auth** | Nenhuma |
| **Secrets** | `RD_STATION_CLIENT_ID` |
| **Criticidade** | MÉDIA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `rd-station-sync-leads`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (cron ou webhook) |
| **Propósito** | Sincroniza leads do RD Station para CRM |
| **Auth** | Token interno |
| **Externas** | RD Station API |
| **DB** | Service Role |
| **Criticidade** | ALTA |
| **Risco** | MÉDIO |
| **Recomendação** | Tokens OAuth expiram em 24h — verificar refresh mechanism |

---

#### `rd-station-send-event`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (token interno) |
| **Propósito** | Envia eventos de conversão para RD Station |
| **Externas** | RD Station API |
| **Criticidade** | MÉDIA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `rd-station-webhook`
| Campo | Valor |
|-------|-------|
| **Tipo** | Webhook (recebido do RD Station) |
| **Propósito** | Recebe eventos do RD Station (leads, oportunidades) |
| **Auth** | Sem verificação de assinatura (só URL secreta) |
| **HTTP** | POST |
| **DB** | Service Role |
| **Criticidade** | ALTA |
| **Risco** | MÉDIO |
| **Recomendação** | **Atualizar URL do webhook no painel RD Station** após migração |

---

#### `rd-station-stats`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Retorna estatísticas de leads do RD Station |
| **Externas** | RD Station API |
| **Criticidade** | BAIXA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `rd-station-list-contacts`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Lista contatos do RD Station |
| **Externas** | RD Station API |
| **Criticidade** | BAIXA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

### GRUPO 7: IMOBZI

---

#### `imobzi-import`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Orquestra importação completa de imóveis do Imobzi |
| **Auth** | JWT getClaims |
| **HTTP** | POST |
| **Externas** | Imobzi API |
| **DB** | Service Role |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` |
| **Criticidade** | CRÍTICA |
| **Risco** | ALTO |
| **Recomendação** | API key do Imobzi armazenada no DB; verificar `imobzi_settings` após migração |

---

#### `imobzi-process`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (service role chaining) |
| **Propósito** | Processa batch de imóveis Imobzi, faz upload de fotos |
| **Auth** | Service role chain do imobzi-import |
| **Externas** | Imobzi API, Cloudinary |
| **DB** | Service Role |
| **Secrets** | `SUPABASE_*`, `CLOUDINARY_*` |
| **Criticidade** | CRÍTICA |
| **Risco** | ALTO |
| **Recomendação** | Batch processing complexo; testar com dados reais após migração |

---

#### `imobzi-list`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Lista propriedades disponíveis no Imobzi |
| **Externas** | Imobzi API |
| **Criticidade** | MÉDIA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

### GRUPO 8: IA / GERAÇÃO

---

#### `generate-property-art`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (Bearer JWT) |
| **Propósito** | Geração de arte de propriedade via IA (webhook) |
| **Externas** | `GENERATE_ART_WEBHOOK` (URL externa) |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GENERATE_ART_WEBHOOK` |
| **Criticidade** | MÉDIA |
| **Risco** | MÉDIO |
| **Recomendação** | Depende de serviço externo de webhook; confirmar disponibilidade |

---

#### `generate-property-video`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Enfileira job de geração de vídeo de propriedade |
| **Externas** | `GENERATE_VIDEO_WEBHOOK` (URL externa) |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GENERATE_VIDEO_WEBHOOK` |
| **Criticidade** | MÉDIA |
| **Risco** | MÉDIO |
| **Recomendação** | Dependente de infra externa; não bloqueia migração |

---

#### `generate-ad-content`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT getUser) |
| **Propósito** | Geração de copy para anúncios via múltiplos providers IA |
| **Externas** | OpenAI, Gemini, Anthropic, Groq, Lovable |
| **DB** | Service Role (billing) |
| **Secrets** | `SUPABASE_*`, múltiplos API keys de IA |
| **Criticidade** | MÉDIA |
| **Risco** | MÉDIO |
| **Recomendação** | Migração direta; confirmar `LOVABLE_API_KEY` |

---

#### `generate-ad-image`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT getUser) |
| **Propósito** | Geração/edição de imagens para anúncios via IA |
| **Externas** | OpenAI (gpt-image-1), Gemini, Stability AI, Leonardo, Flux (BFL) |
| **Secrets** | `SUPABASE_*`, `OPENAI_IMAGE_API_KEY`, `LOVABLE_API_KEY`, `STABILITY_API_KEY`, `IMAGE_STABILITY_KEY` |
| **Criticidade** | MÉDIA |
| **Risco** | MÉDIO |
| **Recomendação** | Muitos providers; confirmar quais são usados em produção |

---

#### `analyze-photo-quality`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (sistema) |
| **Propósito** | Análise de qualidade de fotos via Gemini/Lovable |
| **Externas** | Lovable/Gemini AI |
| **Secrets** | `SUPABASE_*`, `LOVABLE_API_KEY` |
| **Criticidade** | MÉDIA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `summarize-lead`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (sistema) |
| **Propósito** | Gera resumo automático de lead via IA |
| **Externas** | Lovable/Gemini AI |
| **Secrets** | `SUPABASE_*`, `LOVABLE_API_KEY` |
| **Criticidade** | BAIXA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `contract-ai-fill`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT getUser) |
| **Propósito** | Preenchimento automático de contratos via IA |
| **Externas** | Lovable/Gemini AI |
| **Secrets** | `SUPABASE_*`, `LOVABLE_API_KEY` |
| **Criticidade** | ALTA |
| **Risco** | MÉDIO |
| **Recomendação** | Revisar uso do `LOVABLE_API_KEY` — é uma API proprietária Lovable Cloud |

---

#### `generate-contract-template`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (Bearer JWT getUser) |
| **Propósito** | Gera templates de contratos jurídicos via IA |
| **Externas** | Lovable/Gemini AI |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `LOVABLE_API_KEY` |
| **Criticidade** | MÉDIA |
| **Risco** | MÉDIO |
| **Recomendação** | Verificar se `LOVABLE_API_KEY` continuará disponível após migração |

---

#### `generate-landing-content`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT getClaims) |
| **Propósito** | Gera conteúdo de landing page de imóveis via Groq |
| **Externas** | Groq AI |
| **Secrets** | `SUPABASE_*`, `GROQ_LANDING_KEY_1`, `GROQ_LANDING_KEY_2` |
| **Criticidade** | BAIXA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `extract-property-pdf`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT getClaims) |
| **Propósito** | Extrai dados de imóveis de PDFs via Google AI |
| **Externas** | Google Gemini AI |
| **Secrets** | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_AI_PDF_KEY_1`, `GOOGLE_AI_PDF_KEY_2` |
| **Criticidade** | MÉDIA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `test-ai-connection`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (Bearer JWT) |
| **Propósito** | Testa conectividade com providers de IA |
| **Externas** | Múltiplos providers IA |
| **Criticidade** | BAIXA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `validate-document`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública |
| **Propósito** | Valida documentos (CPF, CNPJ, CRECI) |
| **Auth** | Sem auth |
| **Externas** | APIs de validação externas |
| **Criticidade** | BAIXA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

### GRUPO 9: CRM / IMPORTAÇÃO

---

#### `crm-import-leads`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT getClaims) |
| **Propósito** | Importa leads via CSV ou API externa |
| **Externas** | Imobzi API (opcional) |
| **DB** | Service Role |
| **Criticidade** | ALTA |
| **Risco** | MÉDIO |
| **Recomendação** | Migração direta |

---

### GRUPO 10: DADOS / FEEDS

---

#### `portal-xml-feed`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (feed token ou JWT) |
| **Propósito** | Gera XML para portais imobiliários (ZAP, Viva Real, OLX, Imovelweb, Chaves na Mão) |
| **Auth** | Token de feed por URL ou Bearer JWT |
| **HTTP** | GET |
| **DB** | Service Role |
| **Criticidade** | ALTA |
| **Risco** | MÉDIO |
| **Recomendação** | URL do feed muda com nova instância; portais precisam ser atualizados |

---

#### `geocode-properties`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Geocodifica endereços de imóveis via Nominatim |
| **Externas** | Nominatim/OpenStreetMap (sem auth) |
| **DB** | Service Role |
| **Criticidade** | BAIXA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `verify-creci`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Verifica registro CRECI de corretores |
| **Externas** | API CRECI (não documentada) |
| **Criticidade** | BAIXA |
| **Risco** | MÉDIO |
| **Recomendação** | Confirmar API externa ainda disponível |

---

### GRUPO 11: MISCELÂNEA

---

#### `whatsapp-instance` / `whatsapp-send`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Gerencia instâncias WhatsApp e envia mensagens |
| **Externas** | API de WhatsApp (Evolution API ou similar) |
| **Criticidade** | MÉDIA |
| **Risco** | ALTO |
| **Recomendação** | Verificar URL e API key do provider WhatsApp |

---

#### `cache-drive-image`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT getClaims) |
| **Propósito** | Cache de imagens do Google Drive no R2 |
| **Externas** | Google Drive, Cloudflare R2 |
| **Secrets** | `R2_*` + Google Drive (sem chave, acesso público) |
| **Criticidade** | BAIXA |
| **Risco** | MÉDIO |
| **Recomendação** | Migração direta |

---

#### `drive-image-proxy`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública |
| **Propósito** | Proxy para imagens do Google Drive |
| **Auth** | Nenhuma |
| **Criticidade** | BAIXA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `scrape-drive-photos`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT) |
| **Propósito** | Extrai fotos de pastas do Google Drive |
| **Externas** | Google Drive API |
| **Criticidade** | BAIXA |
| **Risco** | MÉDIO |
| **Recomendação** | Confirmar Google Drive API key |

---

#### `ticket-chat`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (webhook) |
| **Propósito** | Chat de suporte interno |
| **Auth** | Token de webhook |
| **Criticidade** | BAIXA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `video-job-status`
| Campo | Valor |
|-------|-------|
| **Tipo** | Pública (Bearer JWT) |
| **Propósito** | Consulta status de jobs de vídeo IA |
| **DB** | Service Role |
| **Criticidade** | BAIXA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

#### `cancel-video-job`
| Campo | Valor |
|-------|-------|
| **Tipo** | Protegida (Bearer JWT getClaims) |
| **Propósito** | Cancela job de geração de vídeo |
| **DB** | User Anon |
| **Criticidade** | BAIXA |
| **Risco** | BAIXO |
| **Recomendação** | Migração direta |

---

## RESUMO POR RISCO DE MIGRAÇÃO

### ALTO RISCO (requerem ação manual)

| Função | Motivo |
|--------|--------|
| `billing` | Envolve dinheiro; CORS e URL da API precisam ser atualizados |
| `billing-webhook` | URL no painel Asaas precisa ser atualizada |
| `admin-users` | Operação destrutiva; decode de JWT manual |
| `meta-oauth-callback` | Redirect URI no Meta precisa ser atualizado |
| `rd-station-oauth-callback` | Redirect URI no RD Station precisa ser atualizado |
| `rd-station-webhook` | URL no painel RD Station precisa ser atualizada |
| `portal-xml-feed` | URLs nos portais imobiliários precisam ser atualizadas |
| `imobzi-import` / `imobzi-process` | API key no DB; lógica de batch complexa |
| `send-push` | Trigger com URL hardcoded precisa de `app_runtime_config` |
| `cleanup-orphan-media` | Operação destrutiva irreversível |
| `admin-audit-metrics` | Depende de `admin_allowlist` com seed correto |

### MÉDIO RISCO (verificação recomendada)

Funções de IA, notificações, storage, e sincronizações.

### BAIXO RISCO (migração direta)

Proxies de imagem, geocoding, feeds de leitura, funções utilitárias.

---

## DEPENDÊNCIA CRÍTICA: `LOVABLE_API_KEY`

Funções que usam `LOVABLE_API_KEY` chamam uma API **proprietária da Lovable Cloud**:
- `analyze-photo-quality`
- `summarize-lead`
- `contract-ai-fill`
- `generate-contract-template`
- `generate-ad-content`
- `generate-ad-image`

> **Risco**: Se esta chave não for transferível ou se a API Lovable não funcionar fora do ambiente Lovable Cloud, todas estas funcionalidades de IA precisarão ser reimplementadas apontando para Gemini/Claude/OpenAI diretamente.

---

*Auditoria gerada por análise estática — nenhuma alteração foi feita no repositório.*

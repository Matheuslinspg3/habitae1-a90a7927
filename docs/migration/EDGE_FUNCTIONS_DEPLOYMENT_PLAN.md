# Plano de Deploy de Edge Functions — Habitae
## Lovable Cloud → Supabase Próprio

**Versão**: 1.1
**Data de elaboração**: 2026-03-18
**Última revisão**: 2026-03-18 (incorporação de confirmações técnicas do Lovable)
**Total de funções**: 68
**Funções com verify_jwt = false**: 35 (explícito em config.toml)
**Stack confirmada**: Edge Functions Deno padrão Supabase — 100% compatível. Sem middleware oculto.

---

## Índice

1. [Inventário Completo de Funções](#1-inventário-completo-de-funções)
2. [Classificação por Perfil de Segurança](#2-classificação-por-perfil-de-segurança)
3. [Mapa de Dependências](#3-mapa-de-dependências)
4. [Estratégia LOVABLE_API_KEY](#4-estratégia-lovable_api_key)
5. [Ordem de Deploy](#5-ordem-de-deploy)
6. [Configuração de config.toml](#6-configuração-de-configtoml)
7. [Gestão de Secrets por Grupo](#7-gestão-de-secrets-por-grupo)
8. [Riscos de Segurança](#8-riscos-de-segurança)
9. [Testes Pós-Deploy por Grupo](#9-testes-pós-deploy-por-grupo)

---

## 1. Inventário Completo de Funções

### GRUPO A — Auth e Plataforma

| Função | verify_jwt | SERVICE_ROLE | LOVABLE_KEY | Observação |
|--------|-----------|--------------|-------------|-----------|
| `platform-signup` | ❌ false | ✅ | ❌ | Criar org + primeiro usuário. Público por design. |
| `accept-invite` | ✅ true | ✅ | ❌ | Aceitar convite de membro |
| `send-invite-email` | ❌ false | ✅ | ❌ | Envio de convites. Requer validação interna de auth |
| `send-reset-email` | ❌ false | ✅ | ❌ | Reset de senha via Resend |
| `manage-member` | ✅ true | ✅ | ❌ | Gerenciar membros da organização |
| `admin-users` | ❌ false | ✅ | ❌ | Admin super-plataforma. Protegido por admin_allowlist |
| `admin-subscriptions` | ❌ false | ✅ | ❌ | Admin de assinaturas. Protegido por admin_allowlist |
| `toggle-maintenance-mode` | ❌ false | ✅ | ❌ | Modo manutenção. Protegido por SERVICE_ROLE check interno |
| `export-database` | ❌ false | ✅ | ❌ | Exportar DB. Protegido por check de role developer |

### GRUPO B — Billing e Pagamentos

| Função | verify_jwt | SERVICE_ROLE | LOVABLE_KEY | Observação |
|--------|-----------|--------------|-------------|-----------|
| `billing` | ✅ true | ✅ | ❌ | Criar customer Asaas, gerenciar cobranças |
| `billing-webhook` | ❌ false | ✅ | ❌ | Recebe eventos do Asaas. Validado por ASAAS_WEBHOOK_TOKEN |
| `ai-billing-stripe` | ✅ true | ✅ | ❌ | Billing de uso de IA |

### GRUPO C — Storage e Mídia

| Função | verify_jwt | SERVICE_ROLE | LOVABLE_KEY | Observação |
|--------|-----------|--------------|-------------|-----------|
| `r2-presign` | ❌ false | ❌ | ❌ | Gerar presigned URL para upload. Validação de org via anon key |
| `r2-upload` | ✅ true | ❌ | ❌ | Upload direto para R2 |
| `cloudinary-sign` | ✅ true | ❌ | ❌ | Assinar upload Cloudinary |
| `cloudinary-image-proxy` | ✅ true | ❌ | ❌ | Proxy de imagens Cloudinary |
| `cloudinary-cleanup` | ✅ true | ✅ | ❌ | Limpar imagens órfãs |
| `cloudinary-purge` | ✅ true | ❌ | ❌ | Purge de cache CDN Cloudinary |
| `cloudflare-purge-cache` | ❌ false | ❌ | ❌ | Purge Cloudflare CDN. Validado por token interno |
| `cleanup-orphan-media` | ❌ false | ✅ | ❌ | Limpeza de mídia órfã (cron-like) |
| `migrate-to-r2` | ❌ false | ✅ | ❌ | Migrar imagens para R2 (utilitário único) |
| `migrate-cloudinary-to-r2` | ❌ false | ✅ | ❌ | Migrar Cloudinary → R2 (utilitário único) |
| `storage-metrics` | ✅ true | ✅ | ❌ | Métricas de storage por organização |
| `cache-drive-image` | ✅ true | ✅ | ❌ | Cache de imagens do Google Drive |
| `drive-image-proxy` | ✅ true | ❌ | ❌ | Proxy de imagens Drive |

### GRUPO D — Meta Ads

| Função | verify_jwt | SERVICE_ROLE | LOVABLE_KEY | Observação |
|--------|-----------|--------------|-------------|-----------|
| `meta-app-id` | ❌ false | ✅ | ❌ | Retorna META_APP_ID para OAuth flow no frontend |
| `meta-oauth-callback` | ❌ false | ✅ | ❌ | Callback OAuth Meta. Recebe `code` do Facebook |
| `meta-save-account` | ❌ false | ✅ | ❌ | Salvar conta Meta após OAuth |
| `meta-sync-leads` | ❌ false | ✅ | ❌ | Sincronizar leads do Meta (cron/manual) |
| `meta-sync-entities` | ❌ false | ✅ | ❌ | Sincronizar ad accounts e campanhas |

### GRUPO E — RD Station

| Função | verify_jwt | SERVICE_ROLE | LOVABLE_KEY | Observação |
|--------|-----------|--------------|-------------|-----------|
| `rd-station-app-id` | ❌ false | ✅ | ❌ | Retorna Client ID para OAuth flow |
| `rd-station-oauth-callback` | ❌ false | ✅ | ❌ | Callback OAuth RD Station |
| `rd-station-sync-leads` | ❌ false | ✅ | ❌ | Sincronizar leads RD (cron/manual) |
| `rd-station-list-contacts` | ✅ true | ✅ | ❌ | Listar contatos RD Station |
| `rd-station-send-event` | ❌ false | ✅ | ❌ | Enviar evento para RD Station |
| `rd-station-stats` | ✅ true | ✅ | ❌ | Estatísticas RD Station |
| `rd-station-webhook` | ❌ false | ✅ | ❌ | Receber eventos do RD Station |

### GRUPO F — Notificações

| Função | verify_jwt | SERVICE_ROLE | LOVABLE_KEY | Observação |
|--------|-----------|--------------|-------------|-----------|
| `onesignal-app-id` | ❌ false | ✅ | ❌ | Retorna ONESIGNAL_APP_ID para SDK frontend |
| `notifications-register-device` | ✅ true | ✅ | ❌ | Registrar device para push |
| `notifications-test` | ✅ true | ✅ | ❌ | Enviar push de teste |
| `send-push` | ❌ false | ✅ | ❌ | Enviar push. Chamado por funções internas |

### GRUPO G — AI e Geração de Conteúdo

| Função | verify_jwt | SERVICE_ROLE | LOVABLE_KEY | Observação |
|--------|-----------|--------------|-------------|-----------|
| `generate-ad-content` | ❌ false | ✅ | ❌ | Gerar texto de anúncio (Groq/Google) |
| `generate-ad-image` | ❌ false | ✅ | ❌ | Gerar imagem de anúncio (Stability) |
| `generate-property-art` | ❌ false | ✅ | ❌ | Arte de imóvel via webhook externo |
| `generate-property-video` | ❌ false | ✅ | ❌ | Vídeo de imóvel via webhook externo |
| `generate-contract-template` | ❌ false | ✅ | ❌ NÃO PORTÁVEL | Gerar modelo de contrato — usa `ai.gateway.lovable.dev`. **Audit obrigatório**: verificar se tem fallback. |
| `generate-landing-content` | ✅ true | ✅ | ❌ | Gerar conteúdo de landing page (usa Groq/Google direto) |
| `summarize-lead` | ❌ false | ✅ | ❌ NÃO PORTÁVEL | Resumir lead — usa `ai.gateway.lovable.dev`. **Audit obrigatório**. |
| `validate-document` | ❌ false | ✅ | ❌ NÃO PORTÁVEL (fallback ✅) | Validar documento — usa Lovable gateway, **fallback confirmado**: retorna `{skipped:true}` se sem key. |
| `analyze-photo-quality` | ❌ false | ✅ | ❌ NÃO PORTÁVEL | Analisar qualidade de foto — usa `ai.gateway.lovable.dev`. **Audit obrigatório**. |
| `contract-ai-fill` | ✅ true | ✅ | ❌ NÃO PORTÁVEL | Preencher contrato com IA — usa Lovable gateway. **Audit obrigatório**. |
| `extract-property-pdf` | ✅ true | ✅ | ❌ NÃO PORTÁVEL | Extrair dados PDF — usa Lovable gateway. **Audit obrigatório**. |
| `test-ai-connection` | ❌ false | ✅ | ❌ NÃO PORTÁVEL (não crítico) | Diagnóstico — provider "lovable" aparecerá como falho sem crash. Sem impacto operacional. |
| `ticket-chat` | ❌ false | ✅ | ❌ | Chat de suporte (Groq/Google) |
| `video-job-status` | ❌ false | ✅ | ❌ | Status de job de vídeo |
| `cancel-video-job` | ❌ false | ✅ | ❌ | Cancelar job de vídeo |

### GRUPO H — Importação e CRM

| Função | verify_jwt | SERVICE_ROLE | LOVABLE_KEY | Observação |
|--------|-----------|--------------|-------------|-----------|
| `imobzi-import` | ✅ true | ✅ | ❌ | Iniciar importação do Imobzi |
| `imobzi-list` | ✅ true | ✅ | ❌ | Listar imóveis disponíveis Imobzi |
| `imobzi-process` | ✅ true | ✅ | ❌ | Processar batch de importação |
| `crm-import-leads` | ✅ true | ✅ | ❌ | Importar leads via CSV |
| `geocode-properties` | ✅ true | ✅ | ❌ | Geocodificar imóveis (Google Maps) |
| `scrape-drive-photos` | ✅ true | ✅ | ❌ | Baixar fotos do Google Drive |
| `portal-xml-feed` | ✅ true | ✅ | ❌ | Feed XML para portais imobiliários |
| `admin-audit-metrics` | ✅ true | ✅ | ❌ | Métricas de auditoria (admin) |

### GRUPO I — WhatsApp e Comunicações

| Função | verify_jwt | SERVICE_ROLE | LOVABLE_KEY | Observação |
|--------|-----------|--------------|-------------|-----------|
| `whatsapp-send` | ✅ true | ✅ | ❌ | Enviar mensagem WhatsApp |
| `whatsapp-instance` | ✅ true | ✅ | ❌ | Gerenciar instância WhatsApp |
| `send-ticket-webhook` | ✅ true | ✅ | ❌ | Webhook para tickets de suporte |

### GRUPO J — Verificações e Utilitários

| Função | verify_jwt | SERVICE_ROLE | LOVABLE_KEY | Observação |
|--------|-----------|--------------|-------------|-----------|
| `verify-creci` | ✅ true | ✅ | ❌ | Verificar registro CRECI do corretor |

---

## 2. Classificação por Perfil de Segurança

### Tier 1 — CRÍTICO (verify_jwt=false + SERVICE_ROLE)

Estas funções são as de **maior risco de segurança**: não verificam JWT do Supabase via middleware, mas usam SERVICE_ROLE internamente. A validação de acesso é feita **manualmente dentro do código** da função. Se houver bug de validação, o impacto é máximo.

**Auditoria obrigatória antes do deploy:**

| Função | Validação interna |
|--------|-----------------|
| `admin-users` | Verifica se email está em `admin_allowlist` |
| `admin-subscriptions` | Verifica se email está em `admin_allowlist` |
| `toggle-maintenance-mode` | Verifica `SERVICE_ROLE_KEY` no header |
| `export-database` | Verifica role 'developer' do usuário via DB |
| `platform-signup` | Sem validação de usuário (é criação de conta) — verificar rate limiting |
| `billing-webhook` | Valida `ASAAS_WEBHOOK_TOKEN` no header |
| `rd-station-webhook` | Verificar validação de origem |
| `meta-oauth-callback` | Verificar `state` param anti-CSRF |
| `rd-station-oauth-callback` | Verificar `state` param anti-CSRF |
| `send-push` | Verificar se só aceita chamadas de funções internas |

### Tier 2 — ALTO RISCO (verify_jwt=false, sem validação forte)

Funções que aceitam chamadas de qualquer origem sem JWT. **Verificar antes do deploy que não expõem dados sensíveis:**

| Função | Risco identificado |
|--------|------------------|
| `meta-sync-leads` | Sem auth — pode ser chamado externamente para disparar sync |
| `meta-sync-entities` | Sem auth — mesma situação |
| `rd-station-sync-leads` | Sem auth — pode expor dados se sync incorreto |
| `generate-ad-content` | Sem auth — uso de créditos de IA por qualquer chamador |
| `generate-ad-image` | Sem auth — uso de créditos de IA por qualquer chamador |
| `summarize-lead` | Sem auth — pode vazar dados de leads se org_id não validado |
| `validate-document` | Sem auth — uso de IA por qualquer chamador |
| `analyze-photo-quality` | Sem auth — uso de IA por qualquer chamador |

**Mitigação**: Verificar que todas estas funções validam `organization_id` via DB lookup antes de processar.

### Tier 3 — MÉDIO RISCO (verify_jwt=true)

Funções com JWT validation normal. Risco é apenas se RLS não estiver configurado corretamente.

### Tier 4 — BAIXO RISCO (utilitários, sem dados sensíveis)

`onesignal-app-id`, `meta-app-id`, `rd-station-app-id`, `test-ai-connection` — retornam valores de configuração públicos.

---

## 3. Mapa de Dependências

### Dependências entre funções

```
platform-signup
  → send-invite-email (chama para enviar email de boas-vindas)
  → (cria organização, profiles, user_roles)

billing
  ← billing-webhook (Asaas chama este, que pode acionar billing)
  → send-push (notifica usuário sobre pagamento)

meta-oauth-callback
  → meta-save-account (salva tokens após OAuth)

meta-sync-leads
  → send-push (notifica sobre novos leads sincronizados)

rd-station-oauth-callback
  → (salva tokens em rd_station_settings)

notifications-register-device
  → (salva em push_subscriptions)

send-push
  ← billing-webhook (chama para notificar pagamento)
  ← meta-sync-leads (chama para notificar novo lead)
  ← notifications-test (para teste)

generate-property-art
  ← (chama webhook externo GENERATE_ART_WEBHOOK)

generate-property-video
  ← (chama webhook externo GENERATE_VIDEO_WEBHOOK)
  → video-job-status (consultar status)
  → cancel-video-job (cancelar job)
```

### Dependência de _shared/

Todas as funções que chamam `ai-billing.ts` do `_shared/`:
- `validate-document`
- `generate-contract-template`
- `summarize-lead`
- `analyze-photo-quality`
- `generate-ad-content`
- `generate-landing-content`
- `ticket-chat`
- `contract-ai-fill`
- `extract-property-pdf`

> O diretório `_shared/` não é uma função deployável separada — é código compartilhado.
> Ele é compilado junto com cada função que o importa.

---

## 4. LOVABLE_API_KEY — Dependência Não Portável

> ⛔ **CONFIRMADO PELO LOVABLE**: `LOVABLE_API_KEY` **não é portável**.
> O endpoint `https://ai.gateway.lovable.dev/v1/chat/completions` é infraestrutura
> proprietária do Lovable Cloud. Ele **não existirá** no ambiente Supabase próprio.
> Provider `"lovable"` nunca deve ser usado em código de produção fora do Lovable Cloud.

### Status por função

| Função | Endpoint usado | Fallback em código | Ação obrigatória |
|--------|---------------|-------------------|-----------------|
| `validate-document` | `ai.gateway.lovable.dev` | ✅ **Confirmado** — retorna `{skipped: true}` | Aceitar degradação OU substituir por Gemini direto |
| `generate-contract-template` | `ai.gateway.lovable.dev` | ❓ **Não auditado** | **Auditar código antes do cutover** |
| `summarize-lead` | `ai.gateway.lovable.dev` | ❓ **Não auditado** | **Auditar código antes do cutover** |
| `analyze-photo-quality` | `ai.gateway.lovable.dev` | ❓ **Não auditado** | **Auditar código antes do cutover** |
| `contract-ai-fill` | `ai.gateway.lovable.dev` | ❓ **Não auditado** | **Auditar código antes do cutover** |
| `extract-property-pdf` | `ai.gateway.lovable.dev` | ❓ **Não auditado** | **Auditar código antes do cutover** |
| `test-ai-connection` | `ai.gateway.lovable.dev` | ✅ Retorna status — sem crash | Sem ação crítica; provider "lovable" aparecerá como falho |

### O que auditar em cada função

Para cada função com status ❓, verificar no código:
```typescript
// Padrão perigoso: sem fallback
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
await fetch("https://ai.gateway.lovable.dev/...", { headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` } });
// Se LOVABLE_API_KEY for undefined → fetch com "Bearer undefined" → 401 do gateway → erro sem tratamento

// Padrão seguro (como em validate-document):
if (!LOVABLE_API_KEY) {
  return new Response(JSON.stringify({ skipped: true }), { ... });
}
```

### Providers diretos válidos para substituição

```typescript
// GROQ (modelos LLM rápidos — já configurado como GROQ_API_KEY_1)
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY = Deno.env.get("GROQ_API_KEY_1");

// GOOGLE GEMINI DIRETO (mesmo modelo que o Lovable gateway usa por baixo)
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const GEMINI_KEY = Deno.env.get("GOOGLE_AI_KEY_1");

// OPENROUTER (proxy compatível com API OpenAI — suporta google/gemini-2.5-flash-lite)
const OR_URL = "https://openrouter.ai/api/v1/chat/completions";
const OR_KEY = Deno.env.get("AI_GATEWAY_API_KEY"); // configurar como secret
```

### Decisão binária — documentar antes de prosseguir

```
[ ] DECISÃO A — Code fix antes do cutover:
    Auditar as 6 funções sem fallback confirmado.
    Substituir `ai.gateway.lovable.dev` por provider direto (Groq ou Gemini).
    Nunca usar provider = "lovable" em produção fora do Lovable Cloud.

[ ] DECISÃO B — Aceitar degradação temporária:
    Condição prévia: auditar e confirmar que cada função falha graciosamente (não 500).
    Se alguma retornar 500 sem handler: a degradação não é segura → vai para Decisão A.
    Prazo de resolução: 7 dias pós-go-live.
    Comunicar usuários sobre temporária indisponibilidade das features de IA afetadas.
```

---

## 5. Ordem de Deploy

**Método preferido**: Deploy de todas as funções de uma vez via CLI.

```bash
# Verificar que config.toml tem o novo project_id
head -1 supabase/config.toml
# Deve mostrar: project_id = "NOVO_PROJECT_ID"

# Deploy de todas as funções
supabase functions deploy --project-ref NOVO_PROJECT_ID

# Aguardar conclusão (~5-10 min para 68 funções)
# Verificar status
supabase functions list --project-ref NOVO_PROJECT_ID
```

### Se deploy em lotes for necessário (em caso de erro parcial):

**Lote 1 — Infraestrutura (deploy primeiro)**
```bash
supabase functions deploy toggle-maintenance-mode --project-ref NOVO_PROJECT_ID
supabase functions deploy export-database --project-ref NOVO_PROJECT_ID
supabase functions deploy admin-users --project-ref NOVO_PROJECT_ID
```

**Lote 2 — Auth e usuários**
```bash
supabase functions deploy platform-signup --project-ref NOVO_PROJECT_ID
supabase functions deploy accept-invite --project-ref NOVO_PROJECT_ID
supabase functions deploy send-invite-email --project-ref NOVO_PROJECT_ID
supabase functions deploy send-reset-email --project-ref NOVO_PROJECT_ID
supabase functions deploy manage-member --project-ref NOVO_PROJECT_ID
```

**Lote 3 — Billing**
```bash
supabase functions deploy billing --project-ref NOVO_PROJECT_ID
supabase functions deploy billing-webhook --project-ref NOVO_PROJECT_ID
supabase functions deploy ai-billing-stripe --project-ref NOVO_PROJECT_ID
```

**Lote 4 — Storage**
```bash
supabase functions deploy r2-presign --project-ref NOVO_PROJECT_ID
supabase functions deploy r2-upload --project-ref NOVO_PROJECT_ID
supabase functions deploy cloudinary-sign --project-ref NOVO_PROJECT_ID
supabase functions deploy cloudinary-image-proxy --project-ref NOVO_PROJECT_ID
supabase functions deploy cloudflare-purge-cache --project-ref NOVO_PROJECT_ID
```

**Lote 5 — Integrações externas**
```bash
supabase functions deploy meta-app-id --project-ref NOVO_PROJECT_ID
supabase functions deploy meta-oauth-callback --project-ref NOVO_PROJECT_ID
supabase functions deploy meta-save-account --project-ref NOVO_PROJECT_ID
supabase functions deploy meta-sync-leads --project-ref NOVO_PROJECT_ID
supabase functions deploy meta-sync-entities --project-ref NOVO_PROJECT_ID
supabase functions deploy rd-station-app-id --project-ref NOVO_PROJECT_ID
supabase functions deploy rd-station-oauth-callback --project-ref NOVO_PROJECT_ID
supabase functions deploy rd-station-sync-leads --project-ref NOVO_PROJECT_ID
supabase functions deploy rd-station-webhook --project-ref NOVO_PROJECT_ID
supabase functions deploy rd-station-list-contacts --project-ref NOVO_PROJECT_ID
supabase functions deploy rd-station-send-event --project-ref NOVO_PROJECT_ID
supabase functions deploy rd-station-stats --project-ref NOVO_PROJECT_ID
```

**Lote 6 — Notificações**
```bash
supabase functions deploy onesignal-app-id --project-ref NOVO_PROJECT_ID
supabase functions deploy notifications-register-device --project-ref NOVO_PROJECT_ID
supabase functions deploy notifications-test --project-ref NOVO_PROJECT_ID
supabase functions deploy send-push --project-ref NOVO_PROJECT_ID
```

**Lote 7 — AI e conteúdo**
```bash
supabase functions deploy generate-ad-content --project-ref NOVO_PROJECT_ID
supabase functions deploy generate-ad-image --project-ref NOVO_PROJECT_ID
supabase functions deploy generate-contract-template --project-ref NOVO_PROJECT_ID
supabase functions deploy generate-landing-content --project-ref NOVO_PROJECT_ID
supabase functions deploy generate-property-art --project-ref NOVO_PROJECT_ID
supabase functions deploy generate-property-video --project-ref NOVO_PROJECT_ID
supabase functions deploy summarize-lead --project-ref NOVO_PROJECT_ID
supabase functions deploy validate-document --project-ref NOVO_PROJECT_ID
supabase functions deploy analyze-photo-quality --project-ref NOVO_PROJECT_ID
supabase functions deploy contract-ai-fill --project-ref NOVO_PROJECT_ID
supabase functions deploy extract-property-pdf --project-ref NOVO_PROJECT_ID
supabase functions deploy ticket-chat --project-ref NOVO_PROJECT_ID
supabase functions deploy test-ai-connection --project-ref NOVO_PROJECT_ID
supabase functions deploy video-job-status --project-ref NOVO_PROJECT_ID
supabase functions deploy cancel-video-job --project-ref NOVO_PROJECT_ID
```

**Lote 8 — CRM e utilitários (restantes)**
```bash
supabase functions deploy imobzi-import --project-ref NOVO_PROJECT_ID
supabase functions deploy imobzi-list --project-ref NOVO_PROJECT_ID
supabase functions deploy imobzi-process --project-ref NOVO_PROJECT_ID
supabase functions deploy crm-import-leads --project-ref NOVO_PROJECT_ID
supabase functions deploy geocode-properties --project-ref NOVO_PROJECT_ID
supabase functions deploy scrape-drive-photos --project-ref NOVO_PROJECT_ID
supabase functions deploy portal-xml-feed --project-ref NOVO_PROJECT_ID
supabase functions deploy admin-audit-metrics --project-ref NOVO_PROJECT_ID
supabase functions deploy admin-subscriptions --project-ref NOVO_PROJECT_ID
supabase functions deploy storage-metrics --project-ref NOVO_PROJECT_ID
supabase functions deploy cleanup-orphan-media --project-ref NOVO_PROJECT_ID
supabase functions deploy migrate-to-r2 --project-ref NOVO_PROJECT_ID
supabase functions deploy migrate-cloudinary-to-r2 --project-ref NOVO_PROJECT_ID
supabase functions deploy cache-drive-image --project-ref NOVO_PROJECT_ID
supabase functions deploy drive-image-proxy --project-ref NOVO_PROJECT_ID
supabase functions deploy cloudinary-cleanup --project-ref NOVO_PROJECT_ID
supabase functions deploy cloudinary-purge --project-ref NOVO_PROJECT_ID
supabase functions deploy whatsapp-send --project-ref NOVO_PROJECT_ID
supabase functions deploy whatsapp-instance --project-ref NOVO_PROJECT_ID
supabase functions deploy send-ticket-webhook --project-ref NOVO_PROJECT_ID
supabase functions deploy verify-creci --project-ref NOVO_PROJECT_ID
```

---

## 6. Configuração de config.toml

### Atualização obrigatória antes do deploy

```toml
# supabase/config.toml — LINHA 1 DEVE SER ATUALIZADA
project_id = "NOVO_PROJECT_ID"  # <- substituir pelo ID real do novo projeto

# As demais configurações de verify_jwt = false devem permanecer idênticas
```

### Verificação após deploy

```bash
# Confirmar que verify_jwt foi aplicado corretamente
# Funções que DEVEM ter verify_jwt=false (conforme config.toml):
FUNCS_NO_JWT="admin-users platform-signup send-invite-email send-reset-email send-push meta-oauth-callback meta-app-id cleanup-orphan-media migrate-to-r2 r2-presign meta-sync-leads meta-sync-entities onesignal-app-id cloudflare-purge-cache admin-subscriptions rd-station-webhook meta-save-account ticket-chat rd-station-sync-leads rd-station-oauth-callback rd-station-app-id rd-station-send-event toggle-maintenance-mode export-database generate-ad-content generate-ad-image test-ai-connection analyze-photo-quality generate-property-art generate-property-video video-job-status cancel-video-job summarize-lead validate-document generate-contract-template"

for func in $FUNCS_NO_JWT; do
  echo "Verificando $func..."
  # Chamar sem Authorization header — deve retornar algo (não 401)
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://NOVO_PROJECT_ID.supabase.co/functions/v1/$func" \
    -X OPTIONS)
  echo "  OPTIONS: $STATUS"
done
```

---

## 7. Gestão de Secrets por Grupo

### Secrets globais (necessários para maioria das funções)

```bash
# Estes devem ser configurados ANTES do primeiro deploy
supabase secrets set --project-ref NOVO_PROJECT_ID \
  SUPABASE_URL=https://NOVO_PROJECT_ID.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  SUPABASE_ANON_KEY=eyJ...
```

### Secrets por grupo de funções

```bash
# Billing (Grupo B)
ASAAS_API_KEY, ASAAS_SANDBOX, ASAAS_WEBHOOK_TOKEN

# Storage (Grupo C)
R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME, R2_PUBLIC_URL
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
CLOUDINARY2_CLOUD_NAME, CLOUDINARY2_API_KEY, CLOUDINARY2_API_SECRET
CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_TOKEN

# Meta (Grupo D)
META_APP_ID, META_APP_SECRET

# RD Station (Grupo E)
RD_STATION_CLIENT_ID, RD_STATION_CLIENT_SECRET

# Notificações (Grupo F)
ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY

# AI (Grupo G)
GROQ_API_KEY_1, GROQ_API_KEY_2
GOOGLE_AI_KEY_1, GOOGLE_AI_KEY_2
OPENAI_IMAGE_API_KEY
STABILITY_API_KEY, IMAGE_STABILITY_KEY
AI_GATEWAY_URL, AI_GATEWAY_API_KEY  # Substituto do LOVABLE_API_KEY
GENERATE_ART_WEBHOOK, GENERATE_VIDEO_WEBHOOK

# Comunicações (Grupo I)
RESEND_API_KEY
UAZAPI_BASE_URL, UAZAPI_ADMIN_TOKEN

# Geral
ENVIRONMENT=production
APP_ALLOWED_ORIGINS=https://SEU_DOMINIO.com.br
APP_URL=https://SEU_DOMINIO.com.br
```

---

## 8. Riscos de Segurança

### Risco 1 — Funções sem JWT com SERVICE_ROLE

**35 funções não verificam JWT via middleware**. Se alguma delas tiver bug de validação manual, qualquer cliente HTTP pode abusar do SERVICE_ROLE.

**Mitigação**:
- Antes do go-live, testar cada função Tier 1 sem credenciais para confirmar que retorna erro (não dados)
- Monitorar logs de funções Tier 1 e 2 por acessos suspeitos nas primeiras 24h

### Risco 2 — CORS aberto em algumas funções

Funções com `"Access-Control-Allow-Origin": "*"` aceitam requests de qualquer domínio.

**Verificar**: O secret `APP_ALLOWED_ORIGINS` deve ser configurado. Funções que usam CORS restritivo dependem deste secret.

```bash
# Verificar que APP_ALLOWED_ORIGINS está configurado
supabase secrets list --project-ref NOVO_PROJECT_ID | grep APP_ALLOWED_ORIGINS
```

### Risco 3 — Functions de migração (migrate-to-r2, migrate-cloudinary-to-r2)

Estas funções sem JWT podem ser chamadas externamente e disparar operações de storage em massa.

**Mitigação**: Após completar a migração de storage, desabilitar estas funções ou adicionar autenticação.

### Risco 5 — pg_net trigger com hardcoded fallback

O migration `20260317204734_fca31fcd.sql` (último cronologicamente) define
`trigger_push_on_notification` com fallback hardcoded para `aiflfkkjitvsyszwdfga.supabase.co`
e anon key do projeto antigo embutida em plaintext no código SQL.

**Comportamento**: o trigger verifica GUC `app.settings.supabase_url` primeiro.
Se configurado corretamente, funciona. Se não configurado, envia push para o projeto ANTIGO.

**Mitigação obrigatória** (executar após `supabase db push`):
```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://NOVO_PROJECT_ID.supabase.co';
ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'NOVO_ANON_KEY';
```

**Evidência**: este passo está comentado no migration `20260317204656_0a31e564.sql` linhas 47-50.

### Risco 6 — generate-* sem JWT consomem créditos de IA (renumerado)

Um atacante pode chamar `generate-ad-content`, `generate-ad-image`, `summarize-lead` repetidamente e consumir créditos de API (Groq, Google AI, Stability AI).

**Mitigação**:
- Verificar que estas funções validam `organization_id` via DB antes de processar
- Configurar rate limiting no Supabase Edge (via API Gateway settings)
- Monitorar `ai_usage_logs` por spikes anômalos

---

## 9. Testes Pós-Deploy por Grupo

### Grupo A — Auth

```bash
# Testar platform-signup (criação de nova org)
curl -X POST "https://NOVO_PROJECT_ID.supabase.co/functions/v1/platform-signup" \
  -H "Content-Type: application/json" \
  -d '{"email": "teste_deploy@habitae.com.br", "password": "Test123!@#", "org_name": "Org Teste Deploy"}' | jq .status

# Testar toggle-maintenance-mode (status)
curl -X GET "https://NOVO_PROJECT_ID.supabase.co/functions/v1/toggle-maintenance-mode" \
  -H "Authorization: Bearer $NEW_SERVICE_ROLE_KEY" | jq .
```

### Grupo B — Billing

```bash
# Testar billing-webhook (sem auth — deve aceitar OPTIONS e retornar 400 sem payload)
curl -X POST "https://NOVO_PROJECT_ID.supabase.co/functions/v1/billing-webhook" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
# Esperado: erro de validação de token, NÃO erro de secret faltando
```

### Grupo C — Storage

```bash
# Testar r2-presign
curl -X POST "https://NOVO_PROJECT_ID.supabase.co/functions/v1/r2-presign" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.jpg", "contentType": "image/jpeg", "organization_id": "ORG_UUID"}' | jq .
# Esperado: {url: "https://...", key: "..."}
```

### Grupo D — Meta

```bash
# Testar meta-app-id
curl "https://NOVO_PROJECT_ID.supabase.co/functions/v1/meta-app-id" | jq .
# Esperado: {app_id: "..."} (não "secret missing")
```

### Grupo F — Notificações

```bash
# Testar onesignal-app-id
curl "https://NOVO_PROJECT_ID.supabase.co/functions/v1/onesignal-app-id" | jq .
# Esperado: {app_id: "..."} (não "secret missing")
```

### Grupo G — AI

```bash
# Testar test-ai-connection (diagnóstico completo)
curl "https://NOVO_PROJECT_ID.supabase.co/functions/v1/test-ai-connection" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
# Esperado: objeto com status de cada provider (groq, google, openai, etc.)
```

---

*Documento versão 1.1 — Revisado em: 2026-03-18*
*Anterior: [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md)*
*Próximo: [INTEGRATIONS_MIGRATION_PLAN.md](./INTEGRATIONS_MIGRATION_PLAN.md)*

# Plano de Migração de Integrações Externas — Habitae
## Lovable Cloud → Supabase Próprio

**Versão**: 1.1
**Data de elaboração**: 2026-03-18
**Última revisão**: 2026-03-18 (incorporação de confirmações técnicas do Lovable)
**Domínio de produção confirmado**: `portadocorretor.com.br`

---

## Índice

1. [Visão Geral das Integrações](#1-visão-geral-das-integrações)
2. [Asaas — Gateway de Pagamentos](#2-asaas--gateway-de-pagamentos)
3. [Meta Ads — Facebook/Instagram](#3-meta-ads--facebookinstagram)
4. [RD Station — CRM](#4-rd-station--crm)
5. [OneSignal — Push Notifications](#5-onesignal--push-notifications)
6. [Cloudflare R2 — Object Storage](#6-cloudflare-r2--object-storage)
7. [Cloudinary — Media Management](#7-cloudinary--media-management)
8. [WhatsApp (UAZAPI)](#8-whatsapp-uazapi)
9. [Imobzi — Importação de Imóveis](#9-imobzi--importação-de-imóveis)
10. [AI Services — Groq, Google AI, OpenAI, Stability](#10-ai-services--groq-google-ai-openai-stability)
11. [LOVABLE_API_KEY — AI Gateway Lovable](#11-lovable_api_key--ai-gateway-lovable)
12. [Google Maps — Geocodificação e Embed](#12-google-maps--geocodificação-e-embed)
13. [Resend — Email Transacional](#13-resend--email-transacional)
14. [Resumo de Ações por Integração](#14-resumo-de-ações-por-integração)

---

## 1. Visão Geral das Integrações

| Integração | Tipo | Impacto da Migração | Ação Necessária | Urgência |
|-----------|------|-------------------|----------------|---------|
| Asaas | Webhook receptor | Alto — sem atualização = sem billing | Atualizar URL no painel Asaas | Durante cutover |
| Meta Ads | OAuth + API | Alto — OAuth flow quebra | Atualizar redirect_uri | 24h antes |
| RD Station | OAuth + Webhook | Alto — OAuth flow quebra | Atualizar redirect_uri | 24h antes |
| OneSignal | SDK client-side | Baixo — app ID não muda | Reconfigurar secrets | Antes do cutover |
| Cloudflare R2 | Storage externo | Nenhum — URLs não mudam | Reconfigurar secrets | Antes do cutover |
| Cloudinary | Storage externo | Nenhum — URLs não mudam | Reconfigurar secrets | Antes do cutover |
| WhatsApp (UAZAPI) | EDGE_BASE_URL | Alto — calls falham | Atualizar var no Easypanel | Durante cutover |
| Imobzi | API key em DB | Baixo — migrado com dados | Testar após migração | Pós-cutover |
| Groq / Google AI | Secrets | Baixo — apenas reconfigurar | Reconfigurar secrets | Antes do cutover |
| LOVABLE_API_KEY | Gateway AI | Médio — não transferível | Substituir por OpenRouter | Antes do cutover |
| Google Maps | API key frontend | Baixo — key restrita por domínio | Verificar domínio autorizado | Pós-cutover |
| Resend | Secrets | Baixo — apenas reconfigurar | Reconfigurar secrets | Antes do cutover |

---

## 2. Asaas — Gateway de Pagamentos

### Visão geral

O Asaas é integrado via:
- **billing function**: Cria customers, gera cobranças, consulta status
- **billing-webhook function**: Recebe notificações de eventos (pagamento, vencimento, etc.)

### Impacto da migração

```
URL do webhook antigo: https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/billing-webhook
URL do webhook novo:   https://NOVO_PROJECT_ID.supabase.co/functions/v1/billing-webhook

IMPACTO SE NÃO ATUALIZAR:
- Eventos de pagamento (paid, overdue, refunded) não serão processados
- Assinaturas não serão ativadas/desativadas automaticamente
- Logs de cobrança ficarão desatualizados
- RISCO: usuários com pagamento confirmado podem ficar sem acesso
```

### Configuração no novo projeto

```bash
# Secrets necessários (mesmo valores do projeto antigo)
ASAAS_API_KEY=valor        # Manter o mesmo (conta Asaas não muda)
ASAAS_SANDBOX=false        # Em produção: false
ASAAS_WEBHOOK_TOKEN=valor  # Manter o mesmo token existente
```

### Ação durante o cutover

**Acessar o painel Asaas após deploy da função billing-webhook:**

```
1. Login em https://app.asaas.com
2. Configurações → Notificações / Integrações → Webhooks
3. Localizar webhook configurado
4. Editar → atualizar URL:
   DE: https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/billing-webhook
   PARA: https://NOVO_PROJECT_ID.supabase.co/functions/v1/billing-webhook
5. Token de autenticação: manter ASAAS_WEBHOOK_TOKEN (mesmo valor)
6. Salvar
7. Usar "Enviar evento de teste" para validar
```

### Validação

```bash
# Verificar que o evento de teste chegou
supabase functions logs billing-webhook --project-ref NOVO_PROJECT_ID | tail -20
# Esperado: log mostrando recebimento do evento de teste

# Verificar que a função processa sem erro 500
curl -X POST "https://NOVO_PROJECT_ID.supabase.co/functions/v1/billing-webhook" \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: $ASAAS_WEBHOOK_TOKEN" \
  -d '{"event": "PAYMENT_CONFIRMED", "payment": {"id": "pay_test", "status": "CONFIRMED"}}' | jq .
```

### Risco de downtime

- **Durante cutover**: 30-60 min sem receber webhooks (baixo risco — Asaas tenta reenviar)
- **Asaas retenta**: eventos não entregues são retentados por até 3 dias
- **Ação**: Após go-live, monitorar o painel Asaas por eventos pendentes de reenvio

---

## 3. Meta Ads — Facebook/Instagram

### Visão geral

Integração via OAuth 2.0 para sincronização de:
- Leads do Facebook Lead Ads
- Contas de anúncios, campanhas e insights
- Ad creatives e estatísticas

### Impacto da migração

```
redirect_uri antigo: https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/meta-oauth-callback
redirect_uri novo:   https://NOVO_PROJECT_ID.supabase.co/functions/v1/meta-oauth-callback

IMPACTO SE NÃO ATUALIZAR:
- Novos fluxos de OAuth do Meta falham (usuários não conseguem conectar conta Meta)
- Tokens existentes (em ad_accounts): CONTINUAM FUNCIONANDO (tokens Meta não dependem do redirect_uri)
- Sincronização de leads existentes: FUNCIONA (usa tokens do DB, migrados)
```

### Configuração no novo projeto

```bash
# Secrets necessários (mesmo valores)
META_APP_ID=valor       # Mesmo App ID (não muda)
META_APP_SECRET=valor   # Mesmo App Secret (não muda)
```

### Ação com 24h de antecedência (PRÉ-CUTOVER)

```
1. Acessar https://developers.facebook.com
2. Selecionar o App do Habitae
3. Produtos → Facebook Login → Configurações
4. URIs de redirecionamento OAuth válidas:
   ADICIONAR: https://NOVO_PROJECT_ID.supabase.co/functions/v1/meta-oauth-callback
   MANTER: https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/meta-oauth-callback (até rollback descartado)
5. Salvar alterações
```

### Verificação dos tokens migrados

```sql
-- No novo projeto, verificar tokens migrados
SELECT
  id,
  organization_id,
  account_name,
  -- NÃO exibir o token completo em logs
  LEFT(access_token, 20) || '...' as token_preview,
  token_expires_at,
  CASE WHEN token_expires_at > NOW() THEN 'VÁLIDO' ELSE 'EXPIRADO' END as status
FROM ad_accounts
WHERE access_token IS NOT NULL
ORDER BY created_at DESC;
```

### Ação pós-cutover se tokens estiverem expirados

```
Tokens Meta expiram em 60 dias (long-lived) ou 1 hora (short-lived).
Se expired: usuário precisa refazer o OAuth flow.

Notificação para usuários afetados:
"Sua conexão com o Meta Ads precisa ser renovada.
Acesse Configurações → Integrações → Meta Ads → Reconectar"
```

---

## 4. RD Station — CRM

### Visão geral

Integração via OAuth 2.0 para:
- Sincronização bidirecional de leads
- Envio de eventos de conversão
- Consulta de contatos e estágios
- Webhook receptor para eventos do RD Station

### Impacto da migração

```
redirect_uri antigo: https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/rd-station-oauth-callback
redirect_uri novo:   https://NOVO_PROJECT_ID.supabase.co/functions/v1/rd-station-oauth-callback

Webhook RD → Habitae antigo: https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/rd-station-webhook
Webhook RD → Habitae novo:   https://NOVO_PROJECT_ID.supabase.co/functions/v1/rd-station-webhook

IMPACTO SE NÃO ATUALIZAR redirect_uri:
- Novos fluxos de OAuth falham
- Tokens existentes: CONTINUAM FUNCIONANDO

IMPACTO SE NÃO ATUALIZAR webhook:
- Eventos do RD Station (lead convertido, estágio mudou) não chegam ao Habitae
```

### Configuração no novo projeto

```bash
RD_STATION_CLIENT_ID=valor
RD_STATION_CLIENT_SECRET=valor
```

### Ação com 24h de antecedência (PRÉ-CUTOVER)

```
1. Acessar https://developers.rdstation.com
2. App de integração → Credenciais
3. Redirect URI:
   ADICIONAR: https://NOVO_PROJECT_ID.supabase.co/functions/v1/rd-station-oauth-callback
   MANTER o antigo durante o período de rollback
```

### Ação durante o cutover (webhook)

```
1. Acessar painel RD Station → Integrações → Webhooks
2. Localizar webhook configurado para o Habitae
3. Atualizar URL:
   DE: https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/rd-station-webhook
   PARA: https://NOVO_PROJECT_ID.supabase.co/functions/v1/rd-station-webhook
4. Salvar e testar
```

### Verificação de tokens migrados

```sql
-- Verificar tokens do RD Station migrados
SELECT
  id,
  organization_id,
  LEFT(oauth_access_token, 20) || '...' as token_preview,
  oauth_token_expires_at,
  CASE WHEN oauth_token_expires_at > NOW() THEN 'VÁLIDO' ELSE 'EXPIRADO' END as status
FROM rd_station_settings
WHERE oauth_access_token IS NOT NULL;
```

> Tokens do RD Station expiram periodicamente. Verificar `oauth_token_expires_at`.
> Se expirado: a função `rd-station-sync-leads` tentará refresh automaticamente usando `oauth_refresh_token`.

---

## 5. OneSignal — Push Notifications

### Visão geral

Integração de push notifications para web e mobile (PWA):
- SDK JavaScript no frontend (usa `ONESIGNAL_APP_ID` público)
- Edge functions para envio de push (usam `ONESIGNAL_REST_API_KEY` privado)
- Service worker customizado para PWA

### Impacto da migração

```
IMPACTO DIRETO: NENHUM — OneSignal é um serviço externo independente do Supabase.
O App ID e as device subscriptions estão vinculados à conta OneSignal, não ao Supabase.

O que muda:
- Secrets ONESIGNAL_APP_ID e ONESIGNAL_REST_API_KEY precisam ser reconfigurados
- Tabela push_subscriptions migrada com os dados
```

### Configuração no novo projeto

```bash
ONESIGNAL_APP_ID=valor          # Mesmo App ID (não muda — é público)
ONESIGNAL_REST_API_KEY=valor    # Mesma REST API Key (não muda)
```

### Dados migrados

```sql
-- Verificar que push_subscriptions foi migrada
SELECT count(*), platform
FROM push_subscriptions
GROUP BY platform;
-- Deve mostrar contagem por platform (web, ios, android)
```

### Considerações sobre service worker

O service worker do OneSignal está configurado no frontend sob `/push/onesignal/`:
```
public/
  push/
    onesignal/
      OneSignalSDKWorker.js  (se existir)
```

Não há mudança necessária. O service worker se atualiza automaticamente quando o usuário reabre o app.

### Validação pós-cutover

```bash
# Testar envio de push via nova function
curl -X POST "https://NOVO_PROJECT_ID.supabase.co/functions/v1/notifications-test" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "UUID_DO_USUARIO_TESTE", "title": "Teste Migração", "body": "Push funcionando!"}' | jq .
```

---

## 6. Cloudflare R2 — Object Storage

### Visão geral

Storage primário de imagens de imóveis. Os arquivos são armazenados no Cloudflare R2 e acessados via URL pública customizada.

### Impacto da migração

```
IMPACTO: NENHUM — R2 é completamente externo ao Supabase.
As URLs de imagens existentes continuam funcionando (não dependem do projeto Supabase).
```

### O que muda

Apenas os secrets precisam ser reconfigurados:

```bash
R2_ACCESS_KEY_ID=valor      # Mesmos valores — conta R2 não muda
R2_SECRET_ACCESS_KEY=valor
R2_ENDPOINT=https://...     # URL do bucket no Cloudflare
R2_BUCKET_NAME=valor
R2_PUBLIC_URL=https://...   # URL pública CDN (custom domain no Cloudflare)
CLOUDFLARE_ZONE_ID=valor    # Para purge de cache
CLOUDFLARE_API_TOKEN=valor
```

### Validação

```bash
# Testar geração de presigned URL
curl -X POST "https://NOVO_PROJECT_ID.supabase.co/functions/v1/r2-presign" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test_migration.jpg", "contentType": "image/jpeg"}' | jq .
# Esperado: {url: "https://...", key: "test_migration.jpg"}

# Fazer upload de arquivo de teste
PRESIGN_RESPONSE=$(curl -s -X POST "https://NOVO_PROJECT_ID.supabase.co/functions/v1/r2-presign" \
  -d '{"filename": "migration_test.jpg", "contentType": "image/jpeg"}' | jq -r '.url')

curl -X PUT "$PRESIGN_RESPONSE" \
  -H "Content-Type: image/jpeg" \
  --data-binary @/tmp/test_image.jpg
# Esperado: 200 OK

# Verificar que arquivo está acessível via URL pública
curl -I "$R2_PUBLIC_URL/migration_test.jpg"
# Esperado: 200 OK

# Limpar arquivo de teste
# (deletar via R2 dashboard ou API)
```

---

## 7. Cloudinary — Media Management

### Visão geral

Sistema de gestão de mídia alternativo/fallback ao R2. Ainda usado para imagens legadas e como backup.

### Impacto da migração

```
IMPACTO: NENHUM — Cloudinary é completamente externo ao Supabase.
URLs de imagens existentes no Cloudinary continuam funcionando.
```

### O que muda

Apenas os secrets:

```bash
# Conta principal
CLOUDINARY_CLOUD_NAME=valor
CLOUDINARY_API_KEY=valor
CLOUDINARY_API_SECRET=valor

# Conta fallback/redundância
CLOUDINARY2_CLOUD_NAME=valor
CLOUDINARY2_API_KEY=valor
CLOUDINARY2_API_SECRET=valor
```

### Validação

```bash
# Testar geração de assinatura Cloudinary
curl -X POST "https://NOVO_PROJECT_ID.supabase.co/functions/v1/cloudinary-sign" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"public_id": "test/migration_test", "folder": "test"}' | jq .
# Esperado: {signature: "...", timestamp: ..., api_key: "..."}
```

---

## 8. WhatsApp (UAZAPI)

### Visão geral

Integração de WhatsApp Business via UAZAPI, rodando em instância separada no Easypanel. O wa-worker faz chamadas de volta para as edge functions do Supabase.

### Impacto da migração

```
IMPACTO: ALTO — o wa-worker tem EDGE_BASE_URL hardcoded apontando ao projeto antigo.
Se não atualizado, mensagens WhatsApp recebidas não serão processadas pelas edge functions novas.
```

### Arquitetura atual

```
WhatsApp → UAZAPI (Easypanel) → EDGE_BASE_URL + "/whatsapp-instance" (Supabase)
                                 EDGE_BASE_URL + "/whatsapp-send" (Supabase)
```

### Ação durante o cutover

```
1. Acessar painel Easypanel
2. Selecionar serviço: wa-worker
3. Environment Variables (ou Config):
   Localizar: EDGE_BASE_URL
   Alterar DE: https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1
   Alterar PARA: https://NOVO_PROJECT_ID.supabase.co/functions/v1
4. Salvar e reiniciar o serviço wa-worker
5. Aguardar serviço reiniciar (~30s)
```

### Configuração no novo projeto

```bash
UAZAPI_BASE_URL=valor        # URL base do UAZAPI (não muda — é externo)
UAZAPI_ADMIN_TOKEN=valor     # Token admin do UAZAPI (não muda)
```

### Validação

```bash
# Testar que whatsapp-instance responde
curl "https://NOVO_PROJECT_ID.supabase.co/functions/v1/whatsapp-instance" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

# Enviar mensagem de teste (se houver número de teste)
curl -X POST "https://NOVO_PROJECT_ID.supabase.co/functions/v1/whatsapp-send" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone": "5511999999999", "message": "Teste migração Habitae"}' | jq .
```

---

## 9. Imobzi — Importação de Imóveis

### Visão geral

Integração com o sistema Imobzi para importação de imóveis. A API key do Imobzi está armazenada no banco de dados (tabela `imobzi_settings`), não como secret de ambiente.

### Impacto da migração

```
IMPACTO: BAIXO — a API key do Imobzi é migrada junto com os dados da tabela imobzi_settings.
Nenhuma configuração externa precisa ser alterada.
```

### Verificação após migração

```sql
-- Verificar que imobzi_settings foi migrada corretamente
SELECT id, organization_id,
  LEFT(api_key, 10) || '...' as api_key_preview,
  created_at
FROM imobzi_settings;
-- Deve retornar as mesmas linhas do projeto antigo
```

### Validação funcional

```bash
# Testar listagem de imóveis via Imobzi (autenticado)
curl -X POST "https://NOVO_PROJECT_ID.supabase.co/functions/v1/imobzi-list" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"organization_id": "ORG_UUID"}' | jq .status
```

---

## 10. AI Services — Groq, Google AI, OpenAI, Stability

### Visão geral

Múltiplos provedores de AI usados para diferentes funcionalidades:

| Provider | Uso | Secret |
|---------|-----|--------|
| Groq | LLM (chat, resumo, conteúdo) | GROQ_API_KEY_1, GROQ_API_KEY_2 |
| Google AI (Gemini) | LLM + Vision | GOOGLE_AI_KEY_1, GOOGLE_AI_KEY_2 |
| OpenAI (DALL-E) | Geração de imagens | OPENAI_IMAGE_API_KEY |
| Stability AI | Geração de imagens | STABILITY_API_KEY, IMAGE_STABILITY_KEY |

### Impacto da migração

```
IMPACTO: NENHUM — são serviços externos.
Apenas reconfigurar os secrets no novo projeto.
```

### Configuração

```bash
supabase secrets set --project-ref NOVO_PROJECT_ID \
  GROQ_API_KEY_1=gsk_... \
  GROQ_API_KEY_2=gsk_... \
  GOOGLE_AI_KEY_1=AIza... \
  GOOGLE_AI_KEY_2=AIza... \
  OPENAI_IMAGE_API_KEY=sk-... \
  STABILITY_API_KEY=sk-... \
  IMAGE_STABILITY_KEY=sk-...
```

### Validação

```bash
# Testar conexão com todos os providers via test-ai-connection
curl "https://NOVO_PROJECT_ID.supabase.co/functions/v1/test-ai-connection" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
# Verificar que cada provider retorna "ok" ou "connected"
```

---

## 11. LOVABLE_API_KEY — AI Gateway Lovable

> ⛔ **NÃO TRANSFERÍVEL. PONTO FINAL.**
>
> `LOVABLE_API_KEY` é auto-provisionada pelo Lovable Cloud e dá acesso a `ai.gateway.lovable.dev`.
> Esse endpoint **não existe fora do Lovable Cloud**. Não há plano enterprise, portabilidade ou exceção.
> Toda função que chama `https://ai.gateway.lovable.dev` **falhará silenciosamente ou com erro 401/404**
> no novo projeto Supabase, pois o endpoint é inacessível.

### Funções afetadas — Status de fallback confirmado

| Função | Uso | Fallback confirmado? | Risco |
|--------|-----|---------------------|-------|
| `validate-document` | Gemini Vision — validação de docs | ✅ Retorna `{skipped: true}` | Baixo — degradação silenciosa |
| `generate-contract-template` | Gemini — geração de contratos | ❌ Auditoria obrigatória | Alto — pode retornar erro 500 |
| `summarize-lead` | Gemini — resumo de lead | ❌ Auditoria obrigatória | Médio |
| `analyze-photo-quality` | Gemini Vision — qualidade foto | ❌ Auditoria obrigatória | Médio |
| `contract-ai-fill` | Gemini — preenchimento de contratos | ❌ Auditoria obrigatória | Alto |
| `extract-property-pdf` | Gemini — extração de dados PDF | ❌ Auditoria obrigatória | Alto |
| `test-ai-connection` | Diagnóstico — verifica LOVABLE_API_KEY | ❌ Auditoria obrigatória | Baixo (diagnóstico apenas) |

**`validate-document` confirmado** (`validate-document/index.ts`):
```typescript
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
if (!LOVABLE_API_KEY) {
  return new Response(JSON.stringify({ skipped: true }), { status: 200 });
}
// Continua apenas se LOVABLE_API_KEY estiver definida
```

As demais **6 funções precisam de auditoria de código** antes do go-live.

### Decisão binária — obrigatória antes do cutover

**Opção A — Code fix (recomendado)**: Substituir `ai.gateway.lovable.dev` por provider direto em cada função.

Providers disponíveis no projeto (secrets já existentes):
```
GROQ_API_KEY_1 / GROQ_API_KEY_2         → Groq (llama3, mixtral)
GOOGLE_AI_KEY_1 / GOOGLE_AI_KEY_2       → Gemini via generativelanguage.googleapis.com
OPENAI_IMAGE_API_KEY                     → OpenAI
AI_GATEWAY_URL + AI_GATEWAY_API_KEY     → OpenRouter (proxy OpenAI-compatible — suporta Gemini)
```

Exemplo de substituição por função (requer code change):
```typescript
// ANTES (não portável):
await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` }, ...
})

// DEPOIS (provider direto via Google AI):
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY_1");
await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_AI_KEY}`, {
  // Nota: API Google AI tem formato diferente da OpenAI — ajuste necessário
})

// OU via OpenRouter (mesmo formato OpenAI):
const gatewayUrl = Deno.env.get("AI_GATEWAY_URL") || "https://openrouter.ai/api/v1";
const gatewayKey = Deno.env.get("AI_GATEWAY_API_KEY");
await fetch(`${gatewayUrl}/chat/completions`, {
  headers: { Authorization: `Bearer ${gatewayKey}` }, ...
})
```

**Opção B — Aceitar degradação documentada**: Não migrar o código. Features de IA ficam desativadas.

```
validate-document     → {skipped: true} — OK (fallback confirmado)
generate-contract-template, contract-ai-fill, extract-property-pdf → FALHA (alto risco de 500)
summarize-lead, analyze-photo-quality → FALHA (risco médio)

Impacto de negócio: usuários não conseguem validar documentos via IA, gerar contratos automáticos,
ou preencher contratos com IA. Funcionalidades manuais continuam disponíveis.
```

> ⚠️ **Se Opção B for escolhida**: documentar explicitamente quais features estão degradadas,
> comunicar usuários afetados, e estabelecer prazo para code fix pós-migração.

### Impacto no cutover

```
LOVABLE_API_KEY não deve ser configurada no novo projeto (seria inútil — endpoint inacessível).
Se code fix (Opção A) não estiver pronto: aceitar degradação explicitamente antes do go-live.
Não tentar "configurar LOVABLE_API_KEY e ver o que acontece" — a key é inválida no novo ambiente.
```

---

## 12. Google Maps — Geocodificação e Embed

### Visão geral

Dois usos:
- **Frontend embed**: `VITE_GOOGLE_MAPS_EMBED_KEY` (exposta no bundle JS, restrita por domínio)
- **Backend geocoding**: `geocode-properties` function usa `GOOGLE_MAPS_API_KEY` (se configurada)

### Impacto da migração

```
Frontend (VITE_GOOGLE_MAPS_EMBED_KEY):
  - API key é restrita por HTTP Referrer (domínio)
  - Se o domínio do app não muda: nenhuma ação necessária
  - Se o domínio muda: adicionar novo domínio no Google Cloud Console

Backend (geocoding):
  - Apenas reconfigurar secret no novo projeto
```

### Ação necessária se domínio mudar

```
1. Google Cloud Console → APIs & Services → Credentials
2. Selecionar a API key usada
3. Website restrictions → Add item
4. Adicionar: novo-dominio.com.br/*
5. Salvar
```

---

## 13. Resend — Email Transacional

### Visão geral

Usado para envio de emails transacionais:
- Convites de membros (`send-invite-email`)
- Reset de senha (`send-reset-email`)
- Tickets de suporte (`send-ticket-webhook`)

### Impacto da migração

```
IMPACTO: MÍNIMO — Resend é externo ao Supabase.
Apenas reconfigurar o secret RESEND_API_KEY.
```

### Verificação de domínio de envio

```
Resend valida o domínio de envio via DKIM/SPF.
O domínio de envio (ex: noreply@habitae.com.br) não muda.
Nenhuma ação adicional necessária.
```

### Configuração

```bash
RESEND_API_KEY=re_...
```

### Validação

```bash
# Testar envio de email de reset (com email de teste)
curl -X POST "https://NOVO_PROJECT_ID.supabase.co/functions/v1/send-reset-email" \
  -H "Content-Type: application/json" \
  -d '{"email": "teste@habitae.com.br"}' | jq .
# Verificar que email foi enviado (checar inbox)
```

---

## 14. Resumo de Ações por Integração

### Pré-cutover (D-2 a D-7)

| Ação | Integração | Responsável |
|------|-----------|------------|
| Decidir: code fix (Opção A) ou degradação aceita (Opção B) para 6 funções AI sem fallback | LOVABLE_API_KEY | Engenharia/Product |
| Se Opção A: auditar e corrigir código das 6 funções AI — substituir `ai.gateway.lovable.dev` por provider direto | LOVABLE_API_KEY | Engenharia |
| Adicionar novo redirect_uri no Facebook App | Meta Ads | Engenharia/Marketing |
| Adicionar novo redirect_uri no RD Station | RD Station | Engenharia/Marketing |
| Adicionar novo domínio no Google Maps (se mudar) | Google Maps | Engenharia |

### Durante o cutover (Janela de manutenção)

| Ação | Integração | Momento |
|------|-----------|---------|
| Atualizar webhook URL no painel Asaas | Asaas | Pós-deploy functions |
| Atualizar webhook URL no painel RD Station | RD Station | Pós-deploy functions |
| Atualizar EDGE_BASE_URL no Easypanel | WhatsApp (UAZAPI) | Pós-deploy functions |
| `ALTER DATABASE SET app.settings.supabase_url` e `app.settings.supabase_anon_key` | pg_net (trigger push) | Imediatamente após `supabase db push` |

### Pós-cutover (D+0 a D+7)

| Ação | Integração | Prazo |
|------|-----------|-------|
| Verificar tokens Meta migrados e notificar usuários se expirados | Meta Ads | D+1 |
| Verificar tokens RD Station e disparar refresh | RD Station | D+1 |
| Remover redirect_uris antigas (Meta, RD) | Meta + RD | D+7 (após rollback descartado) |
| Desabilitar projeto Lovable antigo | Todos | D+3 (após confirmar estabilidade) |

---

*Documento gerado em: 2026-03-18*
*Anterior: [EDGE_FUNCTIONS_DEPLOYMENT_PLAN.md](./EDGE_FUNCTIONS_DEPLOYMENT_PLAN.md)*
*Próximo: [FINAL_VALIDATION_CHECKLIST.md](./FINAL_VALIDATION_CHECKLIST.md)*

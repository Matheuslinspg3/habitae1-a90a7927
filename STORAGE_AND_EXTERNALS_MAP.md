# STORAGE AND EXTERNALS MAP — Habitae1

**Data**: 2026-03-18 | **Foco**: Storage real, uploads, CDN e integrações externas

---

## 1. ARQUITETURA DE STORAGE

O projeto usa **três camadas de storage** com prioridades distintas:

```
┌─────────────────────────────────────────────────────┐
│                IMAGENS DE IMÓVEIS                    │
│                                                      │
│  1. Cloudflare R2 (primário)                        │
│     └── Variantes: _full.webp + _thumb.webp          │
│     └── CDN: VITE_R2_PUBLIC_URL                      │
│                                                      │
│  2. Cloudinary (fallback / legado)                  │
│     └── Deduplicação por SHA-1                       │
│     └── Transformações server-side                   │
│                                                      │
│  3. Supabase Storage (uso mínimo)                   │
│     └── brand-assets (logos)                         │
│     └── lead-documents (PDFs)                        │
│     └── pdf-imports (temporário)                     │
└─────────────────────────────────────────────────────┘
```

---

## 2. CLOUDFLARE R2 — STORAGE PRIMÁRIO

### Como funciona

**Fluxo de upload (presigned)**:

```
Frontend                    Edge Function              Cloudflare R2
   │                        r2-presign                      │
   │──POST /r2-presign─────►│                              │
   │   { propertyId, files }│                              │
   │                        │── AWS SigV4 (HmacSHA256) ───►│
   │◄─────────────────────── presigned PUT URLs             │
   │                        │                              │
   │── PUT direto ao R2 ─────────────────────────────────►│
   │   Headers: Content-Type, x-amz-date, Authorization    │
   │◄──────────────────────────────────────────────────── 200 OK
   │                        │                              │
   │── salva r2_key_full + r2_key_thumb no DB              │
```

### Estrutura de URLs R2

```
Key format:     imoveis/{propertyId}/{uploadId}_full.webp
                imoveis/{propertyId}/{uploadId}_thumb.webp

URL pública:    {R2_PUBLIC_URL}/{key}
Exemplo:        https://cdn.habitae.com/imoveis/prop-uuid/img-uuid_full.webp
                https://cdn.habitae.com/imoveis/prop-uuid/img-uuid_thumb.webp
```

### Variantes de imagem

Geradas no **cliente** via Canvas API antes do upload:

| Variante | Dimensões máximas | Formato | Uso |
|----------|------------------|---------|-----|
| `_thumb` | 400px | WebP | Listagens, grids |
| `_full` | 1920px | WebP | Visualização detalhada |

### Validações no `r2-presign`

- Máximo 50 arquivos por request
- Máximo 5MB por arquivo
- MIME types permitidos: `image/jpeg`, `image/png`, `image/webp`, `image/heic`
- Presigned URL válida por 600 segundos (10 minutos)
- Credenciais validadas: `R2_ACCESS_KEY_ID` (32 chars), `R2_SECRET_ACCESS_KEY` (64 chars)

### Variáveis de Ambiente R2

```bash
# Backend (edge functions)
R2_ACCESS_KEY_ID          # 32 chars — access key AWS-compatible
R2_SECRET_ACCESS_KEY      # 64 chars — secret key
R2_ENDPOINT               # https://ACCOUNT_ID.r2.cloudflarestorage.com
R2_BUCKET_NAME            # nome do bucket
R2_PUBLIC_URL             # https://cdn.habitae.com (domínio customizado)

# Frontend (exposta no bundle)
VITE_R2_PUBLIC_URL        # mesmo valor que R2_PUBLIC_URL (para resolver URLs)
```

### O que quebra se R2 estiver indisponível

1. Uploads de novas imagens falham → fallback automático para Cloudinary
2. Imagens existentes ficam inacessíveis se CDN cair (sem cache local)
3. Limpeza de mídia órfã (`cleanup-orphan-media`) falha parcialmente

---

## 3. CLOUDINARY — FALLBACK E LEGADO

### Como funciona

**Fluxo de upload (signed)**:

```
Frontend                    Edge Function              Cloudinary
   │                        cloudinary-sign                 │
   │──POST /cloudinary-sign─►│                             │
   │   { fileHash, folder }  │                             │
   │                         │── SHA-1 signature ──────────│
   │◄── { signature, timestamp, api_key, ... }             │
   │                         │                             │
   │── POST para Cloudinary API direto ────────────────────►│
   │   multipart/form-data                                  │
   │◄──────────────────────────────────────────────────── secure_url
```

### Deduplicação por hash

```typescript
// public_id = "folder/SHA1(fileContent)"
// Com overwrite: false → retorna imagem existente se public_id já existe
// Resultado: mesmo arquivo nunca é enviado duas vezes
```

### Transformações aplicadas server-side

```
c_limit,w_2048,h_2048     → Limita a 2048x2048px (mantém aspect ratio)
q_auto:good               → Compressão automática (qualidade boa)
fl_strip_profile          → Remove metadados EXIF/ICC
```

### Estrutura de URLs Cloudinary

```
Padrão:   https://res.cloudinary.com/{CLOUD_NAME}/image/upload/.../{public_id}
Exemplo:  https://res.cloudinary.com/habitae/image/upload/c_limit,w_2048/imoveis/abc123

Proxied:  /functions/v1/cloudinary-image-proxy?url={encodedUrl}
          (usado para evitar CORS e 401 no browser)
```

### Variáveis de Ambiente Cloudinary

```bash
CLOUDINARY_CLOUD_NAME     # Ex: "habitae"
CLOUDINARY_API_KEY        # Chave pública
CLOUDINARY_API_SECRET     # Chave secreta (nunca exposta)
CLOUDINARY2_CLOUD_NAME    # Conta secundária (backup opcional)
CLOUDINARY2_API_KEY
CLOUDINARY2_API_SECRET
```

### O que quebra se Cloudinary estiver indisponível

1. Fallback de uploads falha (R2 era o primário)
2. Imagens legadas (pré-migração para R2) ficam inacessíveis
3. `imobzi-process` falha ao fazer upload de fotos de imóveis importados
4. `cleanup-orphan-media` não consegue deletar assets no Cloudinary

---

## 4. SUPABASE STORAGE — USO MÍNIMO

### Buckets em uso

| Bucket | Localização | Operações | Isolamento |
|--------|-------------|-----------|-----------|
| `brand-assets` | `src/components/marketing/BrandSettingsContent.tsx` | upload, getPublicUrl | Por org (path inclui org_id) |
| `lead-documents` | `src/hooks/useLeadDocuments.ts` | upload, getPublicUrl, remove | Por usuário/org |
| `pdf-imports` | `src/lib/pdfProcessor.ts` | upload, remove (temporário) | Por sessão |
| `property-images` | (legado) | upload, delete | **INSEGURO** — sem isolamento por org |

### Problemas de RLS nos buckets

```sql
-- ❌ INSEGURO: qualquer autenticado deleta imagens de qualquer org
CREATE POLICY "Users can delete their property images"
ON storage.objects FOR DELETE
USING (bucket_id = 'property-images' AND auth.uid() IS NOT NULL);

-- ✅ DEVERIA SER:
USING (
  bucket_id = 'property-images'
  AND (storage.foldername(name))[1] = get_user_organization_id()::text
);
```

---

## 5. RESOLUÇÃO DE URLS DE IMAGEM (Frontend)

**Arquivo**: `src/lib/imageUrl.ts`

Prioridade de resolução:

```typescript
function resolveImageUrl(media: PropertyMedia, variant: 'thumb' | 'full'): string {
  // 1. R2 (primário)
  if (variant === 'thumb' && media.r2_key_thumb) {
    return `${R2_PUBLIC_URL}/${media.r2_key_thumb}`;
  }
  if (variant === 'full' && media.r2_key_full) {
    return `${R2_PUBLIC_URL}/${media.r2_key_full}`;
  }

  // 2. Cloudinary (fallback/legado)
  if (media.cloudinary_url) {
    return proxyCloudinaryUrl(media.cloudinary_url);  // via edge function
  }

  // 3. URL direta armazenada
  if (media.url) return media.url;

  // 4. Placeholder
  return '/placeholder.svg';
}
```

### Responsive Images (srcSet)

Apenas para R2 (Cloudinary não gera variantes automáticas):

```typescript
srcSet = `${thumbUrl} 400w, ${fullUrl} 1920w`
sizes = "(max-width: 640px) 400px, 1920px"
```

---

## 6. BILLING — ASAAS

### Visão geral

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DE BILLING                          │
│                                                              │
│  1. Criar Cliente Asaas (por CPF/CNPJ da org)               │
│     ↓                                                        │
│  2. Criar Assinatura/Pagamento                               │
│     ├── PIX → pagamento avulso → QR Code                    │
│     ├── Cartão → assinatura recorrente → invoice URL        │
│     └── Boleto → assinatura recorrente                      │
│     ↓                                                        │
│  3. Status = "pending" no DB                                 │
│     ↓                                                        │
│  4. Asaas envia webhook → billing-webhook                   │
│     ↓                                                        │
│  5. Status atualizado → "active" / "cancelled"              │
└─────────────────────────────────────────────────────────────┘
```

### Tabelas de database atualizadas

```sql
subscriptions {
  organization_id,
  plan_id,                    -- FK → subscription_plans
  status,                     -- pending | active | trial | cancelled | expired
  provider: 'asaas',
  provider_customer_id,       -- ID do customer no Asaas
  provider_subscription_id,   -- ID da assinatura no Asaas
  billing_cycle,              -- monthly | yearly
  current_period_end,
  pix_qr_code,               -- Base64 do QR (para PIX)
  pix_copy_paste,            -- Código copia e cola PIX
  invoice_url                -- Link do boleto/invoice
}

billing_payments {
  organization_id,
  subscription_id,
  provider: 'asaas',
  provider_payment_id,
  amount_cents,
  status,                    -- pending | confirmed | cancelled
  payment_method             -- pix | credit_card | boleto
}
```

### Detecção de sandbox vs produção

```typescript
const isSandbox =
  Deno.env.get("ASAAS_SANDBOX") === "true" ||
  apiKey.startsWith("$aact_hmlg");  // prefix identifica sandbox

const baseUrl = isSandbox
  ? "https://sandbox.asaas.com/api/v3"
  : "https://api.asaas.com/v3";
```

### Pontos de acoplamento

- URL do webhook (`billing-webhook`) registrada no painel Asaas **precisa ser atualizada após migração**
- `ASAAS_WEBHOOK_TOKEN` deve ser o mesmo token configurado no painel Asaas
- `APP_ALLOWED_ORIGINS` na função `billing` bloqueia requests de origens não listadas (fail-closed)

---

## 7. ONESIGNAL — NOTIFICAÇÕES PUSH

### Arquitetura

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Browser   │         │   Supabase  │         │  OneSignal  │
│   (PWA)     │         │  DB/Function│         │     API     │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │ OneSignal SDK init     │                       │
       │──────────────────────────────────────────────►│
       │ Permission request     │                       │
       │◄─────────────────────────────────────────────── subscription_id
       │                       │                       │
       │ POST /notifications-register-device           │
       │──────────────────────►│                       │
       │                       │ UPSERT user_devices   │
       │                       │◄──────────────────────│
       │                       │                       │
       │ (usuário gera evento) │                       │
       │──────────────────────►│ INSERT notifications  │
       │                       │──────── trigger ──────│
       │                       │   send-push           │
       │                       │──────────────────────►│ /notifications
       │◄─────────────────────────────────────────────── push entregue
```

### Inicialização do SDK (Frontend)

**Arquivo**: `src/lib/onesignal.ts` (489 linhas)

Etapas críticas:
1. Verifica `isSecureContext` (HTTPS obrigatório)
2. Remove service workers legados de root scope
3. Busca `ONESIGNAL_APP_ID` do endpoint `/onesignal-app-id`
4. Carrega SDK via `<script>` do CDN OneSignal
5. Inicializa com `serviceWorkerPath: /push/onesignal/OneSignalSDKWorker.js`
6. Registra device: `window.OneSignal.User.PushSubscription.id`

### Arquivos do Service Worker (CRÍTICOS)

Devem estar no servidor em:
```
/push/onesignal/OneSignalSDKWorker.js
/push/onesignal/OneSignalSDKUpdaterWorker.js
```

Configurados em `vite.config.ts` como assets estáticos.

### Tabela `user_devices`

```sql
user_devices {
  id UUID,
  user_id UUID,           -- FK → auth.users
  onesignal_id TEXT,      -- subscription_id do OneSignal
  platform TEXT,          -- 'web' | 'android' | 'ios'
  last_seen_at TIMESTAMP,
  metadata JSONB          -- userAgent, host, optedIn, etc.
}
```

### Limpeza automática de devices inválidos

Quando OneSignal retorna `errors.invalid_subscription_ids`, o `notification-service` automaticamente deleta esses registros de `user_devices`.

---

## 8. META ADS — OAUTH E SINCRONIZAÇÃO

### Fluxo OAuth

```
App ──► /meta-app-id (GET App ID público)
    ──► Redirect para https://www.facebook.com/v21.0/dialog/oauth
    ◄── Redirect para /meta-oauth-callback?code=...&state=...
    ──► Exchange: code → short-lived token → long-lived token (~60 dias)
    ──► Salva em ad_accounts.auth_payload
```

### Dados armazenados em `ad_accounts`

```json
{
  "provider": "meta",
  "auth_payload": {
    "access_token": "<long-lived-token>",
    "token_type": "bearer",
    "expires_in": 5184000,
    "obtained_at": "2026-03-18T00:00:00.000Z",
    "ad_accounts": [{ "id": "act_123", "name": "Habitae", "status": 1 }]
  }
}
```

### Ponto de acoplamento crítico

- `redirect_uri` registrado no painel Meta deve corresponder exatamente à URL da edge function
- Após migração: `https://NEW_PROJECT.supabase.co/functions/v1/meta-oauth-callback`
- Token expira em ~60 dias — usuários precisarão reconectar

---

## 9. RD STATION — OAUTH E SINCRONIZAÇÃO

### Fluxo OAuth

```
App ──► /rd-station-app-id (GET Client ID)
    ──► Redirect para https://api.rd.services/auth/dialog
    ◄── Redirect para /rd-station-oauth-callback?code=...&state=...
    ──► POST https://api.rd.services/auth/token
    ──► Salva access_token + refresh_token em rd_station_settings
```

### Dados armazenados em `rd_station_settings`

```sql
{
  organization_id,
  oauth_access_token,          -- Expira em 24h
  oauth_refresh_token,         -- Para renovação
  oauth_token_expires_at,
  oauth_client_id
}
```

### Problema crítico de expiração

Tokens expiram em **24 horas**. O código de sincronização deve verificar e renovar antes de cada chamada.

---

## 10. RESEND — EMAIL TRANSACIONAL

### Templates usados

#### Email de Convite de Plataforma
```
From:    Porta do Corretor <noreply@portadocorretor.com.br>
Subject: A Porta do Corretor se abriu para você!
Body:    HTML com link de convite + 7 dias grátis
```

#### Email de Convite de Equipe
```
From:    Porta do Corretor <noreply@portadocorretor.com.br>
Subject: A Porta do Corretor se abriu para você — {orgName}
Body:    HTML com link + código da org + nome do convidante
```

#### Email de Reset de Senha
```
From:    Porta do Corretor <noreply@portadocorretor.com.br>
Subject: Redefinição de Senha — Porta do Corretor
Body:    HTML com link de reset (gerado via Supabase auth.admin.generateLink())
Validade: 1 hora
```

### Dependência crítica

O domínio `portadocorretor.com.br` **precisa estar verificado no Resend** para os emails serem entregues. Após migração, confirmar que o DNS do Resend continua configurado para este domínio.

---

## 11. IMOBZI — IMPORTAÇÃO DE IMÓVEIS

### Fluxo completo

```
1. Usuário inicia importação → POST /imobzi-import
2. imobzi-import orquestra:
   ├── Verifica credenciais (imobzi_settings.api_key do DB)
   ├── Cria import_run (registro de histórico)
   └── Chama imobzi-process em batches (10 imóveis por vez)

3. imobzi-process para cada imóvel:
   ├── Busca dados completos na API Imobzi
   ├── Mapeia para schema interno (properties)
   ├── Faz upload de fotos para Cloudinary
   │   (deduplicação por SHA-256 do conteúdo)
   └── Upsert no banco

4. Resultado salvo em import_run_items
```

### Credenciais armazenadas no banco

```sql
imobzi_settings {
  organization_id,
  api_key TEXT ENCRYPTED,    -- Chave de API por org
  last_sync_at,
  sync_status
}
```

### Risco crítico

- API key armazenada no banco — não precisa ser migrada como env var
- Mas os dados da tabela `imobzi_settings` precisam ser migrados junto com o banco
- Lógica de batch pode atingir timeouts em importações grandes (10min limit das edge functions)

---

## 12. PORTAL XML FEED

### Portais suportados

| Portal | Formato XML | Endpoint |
|--------|------------|---------|
| ZAP Imóveis | VRSync | `/portal-xml-feed?portal=zap&feed_id=X&token=Y` |
| Viva Real | VRSync | `/portal-xml-feed?portal=vivareal&feed_id=X&token=Y` |
| OLX | VRSync | `/portal-xml-feed?portal=olx&feed_id=X&token=Y` |
| Imovelweb | Navent | `/portal-xml-feed?portal=imovelweb&feed_id=X&token=Y` |
| Chaves na Mão | Custom | `/portal-xml-feed?portal=chaves&feed_id=X&token=Y` |

### Impacto na migração

Cada portal tem a URL do feed configurada na plataforma deles. Após migração, a URL mudará de:
```
https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/portal-xml-feed
```
para:
```
https://NEW_PROJECT.supabase.co/functions/v1/portal-xml-feed
```

Todos os portais precisarão ter a URL atualizada manualmente.

---

## 13. AI PROVIDERS — BILLING RASTREADO

### Providers em uso

| Provider | Uso | Chave |
|----------|-----|-------|
| Lovable/Gemini | Análise de fotos, resumo de leads, contratos | `LOVABLE_API_KEY` |
| OpenAI | Imagens (gpt-image-1), conteúdo de ads | `OPENAI_IMAGE_API_KEY` |
| Anthropic | Contratos e copywriting | (integrado via `LOVABLE_API_KEY`?) |
| Groq | Landing pages | `GROQ_LANDING_KEY_1`, `GROQ_LANDING_KEY_2` |
| Stability AI | Geração de imagens | `STABILITY_API_KEY`, `IMAGE_STABILITY_KEY` |
| Google AI | PDF extraction | `GOOGLE_AI_PDF_KEY_1`, `GOOGLE_AI_PDF_KEY_2` |

### Tabela de preços (seed data crítico)

```sql
ai_billing_pricing {
  provider, model,
  price_per_1k_input_tokens,
  price_per_1k_output_tokens,
  markup_percentage: 30,    -- markup padrão
  currency: 'USD'
}
```

> **Atenção**: Esta tabela precisa ser migrada junto com os dados ou ter seed data equivalente na nova instância.

### Rastreamento de uso

Cada chamada de IA registra em `ai_token_usage_events`:
- provider, model, function_name
- input_tokens, output_tokens, total_tokens
- estimated_provider_cost, markup_percentage
- stripe_sync_status: 'pending' → 'synced'

---

## 14. SERVIÇOS SEM AUTENTICAÇÃO

### ViaCEP
- **Uso**: `src/lib/viaCep.ts`
- **API**: `https://viacep.com.br/ws/{cep}/json/`
- **Sem chave** — API pública brasileira
- **Fallback**: Usuário digita endereço manualmente

### Microsoft Clarity
- **Uso**: `src/lib/clarity.ts`
- **Project ID hardcoded**: `vpil7qz4th`
- **Carregado**: apenas após consentimento LGPD
- **Impact**: Apenas analytics, não afeta funcionalidade

### Nominatim / OpenStreetMap
- **Uso**: `supabase/functions/geocode-properties/index.ts`
- **API**: `https://nominatim.openstreetmap.org/search`
- **Sem chave** — API pública
- **Rate limit**: 1 request/segundo (usuário deve respeitar)

---

## 15. ANÁLISE DE ACOPLAMENTO

### Fortemente Acoplado (impede migração parcial)

| Componente | Motivo |
|-----------|--------|
| R2 + Frontend | `VITE_R2_PUBLIC_URL` hardcoded em build time |
| Cloudinary + `imobzi-process` | Upload direto sem abstração |
| Asaas + `subscriptions` table | Schema de dados acoplado ao provider |
| OneSignal + `user_devices` | IDs OneSignal armazenados diretamente |
| Trigger DB + `send-push` URL | URL da function hardcoded no trigger SQL |

### Fracamente Acoplado (pode migrar independentemente)

| Componente | Motivo |
|-----------|--------|
| RD Station + leads | Dados sync para tabela interna; desconexão não quebra leads existentes |
| Meta Ads + leads | Mesma situação — dados copiados para tabela local |
| Imobzi + properties | Dados copiados para schema interno |
| Clarity | Script opcional, sem impacto funcional |
| ViaCEP | Opcional, sem persistência |

---

*Mapa gerado por análise estática — nenhuma alteração foi feita no repositório.*

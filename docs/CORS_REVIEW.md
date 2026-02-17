# Revisão de CORS nas Edge Functions (PII/financeiro/admin)

## Escopo da intervenção
Foi criado um utilitário compartilhado (`supabase/functions/_shared/cors.ts`) e aplicado às funções com dados sensíveis (PII/financeiro/admin), removendo o uso de `Access-Control-Allow-Origin: *` nesses endpoints.

### Regras adotadas
- `APP_ALLOWED_ORIGINS` é **obrigatório** em todos os ambientes.
- Caso não exista ou esteja vazio, a função retorna erro ao montar cabeçalhos CORS (fail-closed).
- Origem da requisição só é refletida quando estiver na allowlist.
- Quando a origem não estiver na allowlist, aplica o primeiro domínio configurado.

## Funções atualizadas para CORS compartilhado
- `accept-invite`
- `admin-audit-metrics`
- `admin-users`
- `billing`
- `cache-drive-image`
- `cleanup-orphan-media`
- `cloudinary-cleanup`
- `cloudinary-purge`
- `cloudinary-sign`
- `crm-import-leads`
- `extract-property-pdf`
- `generate-landing-content`
- `geocode-properties`
- `imobzi-import`
- `imobzi-list`
- `imobzi-process`
- `platform-signup`
- `r2-upload`
- `scrape-drive-photos`
- `storage-metrics`
- `verify-creci`

## Exceções com `Access-Control-Allow-Origin: *`
### 1) `portal-xml-feed` — **exceção justificada**
Endpoint de feed XML para portais externos e agregadores, com consumo cross-origin de natureza pública/integração. Manter `*` reduz atrito operacional para múltiplos consumidores não autenticados.

### 2) `drive-image-proxy` — **exceção justificada**
Proxy de imagens para renderização em clientes web diversos, com retorno de mídia cacheável e sem dados administrativos/financeiros. O uso de `*` é coerente com o padrão de distribuição pública de assets.

## Pendências operacionais
1. Garantir secret `APP_ALLOWED_ORIGINS` em **dev/staging/prod**.
2. Definir valor como CSV de origens permitidas (ex.: `https://app.habitae.com,https://staging.habitae.com`).
3. Validar chamadas frontend após deploy para confirmar preflight/credenciais.

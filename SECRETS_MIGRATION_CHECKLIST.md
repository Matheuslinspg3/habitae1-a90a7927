# Secrets Migration Checklist

## Objetivo
Consolidar as variáveis necessárias para o Supabase destino e para o frontend, classificando por criticidade, superfície de uso e destino de configuração.

## Leitura rápida
- **Crítico / bloqueia cutover:** precisa existir e ser validado antes da virada.
- **Importante:** necessário para features relevantes, mas não impede o cutover técnico básico.
- **Opcional / condicional:** só configurar se a integração estiver ativa.
- **Legado:** manter apenas enquanto houver dependência remanescente.

## 1. Supabase base do ambiente destino
> Estes valores não são “segredos portáveis de terceiros”, mas são obrigatórios no novo ambiente.

| Variável | Onde configurar | Criticidade | Uso |
|---|---|---:|---|
| `SUPABASE_URL` | Edge Functions / backend | Crítico | Todas as funções que criam client Supabase |
| `SUPABASE_ANON_KEY` | Edge Functions e frontend | Crítico | Auth frontend e chamadas autenticadas |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Crítico | funções administrativas, billing, storage, auth admin |
| `VITE_SUPABASE_URL` | Frontend | Crítico | cliente web |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Crítico | cliente web |
| `VITE_SUPABASE_PROJECT_ID` | Frontend | Importante | maintenance/dev cards e chamadas por project id |

## 2. IA — Edge Functions / backend

| Variável | Tipo | Criticidade | Uso principal | Destino |
|---|---|---:|---|---|
| `GOOGLE_AI_KEY_1` | segredo | **Crítico** | fallback Gemini direto, `ticket-chat`, funções refatoradas | Supabase secrets |
| `GOOGLE_AI_KEY_2` | segredo | **Crítico** | rotação/fallback Gemini direto | Supabase secrets |
| `GOOGLE_AI_PDF_KEY_1` | segredo | Importante | `extract-property-pdf` | Supabase secrets |
| `GOOGLE_AI_PDF_KEY_2` | segredo | Importante | fallback PDF extraction | Supabase secrets |
| `OPENAI_IMAGE_API_KEY` | segredo | Importante | `generate-ad-image` provider OpenAI | Supabase secrets |
| `STABILITY_API_KEY` | segredo | Opcional | `generate-ad-image` provider Stability | Supabase secrets |
| `IMAGE_STABILITY_KEY` | segredo | Opcional | alias/fallback de Stability | Supabase secrets |
| `GROQ_API_KEY_1` | segredo | Opcional | `ticket-chat` | Supabase secrets |
| `GROQ_API_KEY_2` | segredo | Opcional | `ticket-chat` fallback | Supabase secrets |
| `GROQ_LANDING_KEY_1` | segredo | Opcional | `generate-landing-content` | Supabase secrets |
| `GROQ_LANDING_KEY_2` | segredo | Opcional | `generate-landing-content` fallback | Supabase secrets |
| `AI_GATEWAY_URL` | config legado | Legado | `summarize-lead` | Supabase secrets/config |
| `AI_GATEWAY_API_KEY` | segredo legado | Legado | `summarize-lead` | Supabase secrets |
| `LOVABLE_API_KEY` | segredo legado | **Descontinuar** | removido das 6 funções bloqueadoras | não migrar para o novo ambiente se `summarize-lead` também for tratado depois |

### Observação importante
O bloqueador pré-cutover foi removido para as 6 funções principais. O único resíduo identificado no domínio de IA é `summarize-lead`, que deve ser tratado antes do cutover final para eliminar dependência remanescente de gateway.

## 3. Frontend público / configuração exposta

| Variável | Criticidade | Uso | Destino |
|---|---:|---|---|
| `VITE_GOOGLE_MAPS_EMBED_KEY` | Importante | mapas/embed em páginas de imóvel | frontend hosting/env |
| `VITE_R2_PUBLIC_URL` | Importante | resolução de mídia pública | frontend hosting/env |
| `APP_URL` | Crítico | callbacks OAuth, links absolutos, push deep links | Supabase secrets |
| `APP_ALLOWED_ORIGINS` | Crítico | CORS e validações administrativas | Supabase secrets |

## 4. Billing / financeiro

| Variável | Criticidade | Uso | Destino |
|---|---:|---|---|
| `ASAAS_API_KEY` | Crítico | cobrança/assinaturas | Supabase secrets |
| `ASAAS_SANDBOX` | Importante | chave de ambiente (sandbox/prod) | Supabase secrets |
| `ASAAS_WEBHOOK_TOKEN` | Crítico | autenticação do webhook | Supabase secrets |
| `STRIPE_TEST_SECRET_KEY` | Opcional | stripe de billing IA/testes | Supabase secrets |

## 5. Email / comunicação

| Variável | Criticidade | Uso | Destino |
|---|---:|---|---|
| `RESEND_API_KEY` | **Crítico** | `send-invite-email`, `send-reset-email` | Supabase secrets |
| `ONESIGNAL_APP_ID` | Importante | push notifications | Supabase secrets |
| `ONESIGNAL_REST_API_KEY` | Importante | envio de push | Supabase secrets |

## 6. Storage / mídia / CDN

| Variável | Criticidade | Uso | Destino |
|---|---:|---|---|
| `CLOUDINARY_CLOUD_NAME` | Importante | uploads e limpeza | Supabase secrets |
| `CLOUDINARY_API_KEY` | Importante | uploads e administração | Supabase secrets |
| `CLOUDINARY_API_SECRET` | Importante | uploads e administração | Supabase secrets |
| `CLOUDINARY2_CLOUD_NAME` | Opcional | purge/storage métricas | Supabase secrets |
| `CLOUDINARY2_API_KEY` | Opcional | purge/storage métricas | Supabase secrets |
| `CLOUDINARY2_API_SECRET` | Opcional | purge/storage métricas | Supabase secrets |
| `R2_ACCESS_KEY_ID` | Importante | R2 upload/presign/cache | Supabase secrets |
| `R2_SECRET_ACCESS_KEY` | Importante | R2 upload/presign/cache | Supabase secrets |
| `R2_BUCKET_NAME` | Importante | R2 upload/presign/cache | Supabase secrets |
| `R2_ENDPOINT` | Importante | cliente S3 compatível | Supabase secrets |
| `R2_PUBLIC_URL` | Importante | links públicos de mídia | Supabase secrets |

## 7. CRM / marketing / integrações externas

| Variável | Criticidade | Uso | Destino |
|---|---:|---|---|
| `META_APP_ID` | Importante | OAuth Meta Ads | Supabase secrets |
| `META_APP_SECRET` | Importante | OAuth Meta Ads | Supabase secrets |
| `RD_STATION_CLIENT_ID` | Importante | OAuth / sync RD Station | Supabase secrets |
| `RD_STATION_CLIENT_SECRET` | Importante | OAuth / sync RD Station | Supabase secrets |
| `GOOGLE_DRIVE_API_KEY` | Importante | scraping/cache de imagens Drive | Supabase secrets |
| `UAZAPI_BASE_URL` | Importante | integração WhatsApp | Supabase secrets |
| `UAZAPI_ADMIN_TOKEN` | Importante | integração WhatsApp | Supabase secrets |
| `GENERATE_ART_WEBHOOK` | Opcional | geração assíncrona de artes | Supabase secrets |
| `GENERATE_VIDEO_WEBHOOK` | Opcional | geração assíncrona de vídeos | Supabase secrets |

## 8. Infra / deploy / operações

| Variável | Criticidade | Uso | Destino |
|---|---:|---|---|
| `CLOUDFLARE_API_TOKEN` | Importante | purge cache / maintenance toggle | Supabase secrets |
| `CLOUDFLARE_ZONE_ID` | Importante | purge cache / maintenance toggle | Supabase secrets |

## 9. Checklist de configuração do Supabase destino

### Obrigatório antes de qualquer ensaio funcional
- [ ] Configurar `SUPABASE_URL`
- [ ] Configurar `SUPABASE_ANON_KEY`
- [ ] Configurar `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Configurar `APP_URL`
- [ ] Configurar `APP_ALLOWED_ORIGINS`
- [ ] Configurar `RESEND_API_KEY`
- [ ] Configurar `GOOGLE_AI_KEY_1`
- [ ] Configurar `GOOGLE_AI_KEY_2`

### Obrigatório para mídia e operação principal
- [ ] Configurar `R2_ACCESS_KEY_ID`
- [ ] Configurar `R2_SECRET_ACCESS_KEY`
- [ ] Configurar `R2_BUCKET_NAME`
- [ ] Configurar `R2_ENDPOINT`
- [ ] Configurar `R2_PUBLIC_URL`
- [ ] Configurar `CLOUDINARY_CLOUD_NAME`
- [ ] Configurar `CLOUDINARY_API_KEY`
- [ ] Configurar `CLOUDINARY_API_SECRET`

### Obrigatório se billing estiver ativo no go-live
- [ ] Configurar `ASAAS_API_KEY`
- [ ] Configurar `ASAAS_SANDBOX`
- [ ] Configurar `ASAAS_WEBHOOK_TOKEN`

### Obrigatório se integrações estiverem ativas no go-live
- [ ] Configurar `META_APP_ID`
- [ ] Configurar `META_APP_SECRET`
- [ ] Configurar `RD_STATION_CLIENT_ID`
- [ ] Configurar `RD_STATION_CLIENT_SECRET`
- [ ] Configurar `ONESIGNAL_APP_ID`
- [ ] Configurar `ONESIGNAL_REST_API_KEY`
- [ ] Configurar `GOOGLE_DRIVE_API_KEY`
- [ ] Configurar `UAZAPI_BASE_URL`
- [ ] Configurar `UAZAPI_ADMIN_TOKEN`

### Revisão de legado antes do cutover final
- [ ] Decidir se `AI_GATEWAY_URL` / `AI_GATEWAY_API_KEY` continuarão temporariamente para `summarize-lead`
- [ ] Confirmar que `LOVABLE_API_KEY` não é mais necessário nas 6 funções refatoradas
- [ ] Remover `LOVABLE_API_KEY` do destino quando `summarize-lead` também estiver saneado (se aplicável)

## 10. Checklist do frontend
- [ ] Configurar `VITE_SUPABASE_URL`
- [ ] Configurar `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] Configurar `VITE_SUPABASE_PROJECT_ID`
- [ ] Configurar `VITE_GOOGLE_MAPS_EMBED_KEY` se mapas estiverem habilitados
- [ ] Configurar `VITE_R2_PUBLIC_URL`
- [ ] Revisar URLs hardcoded antigas (`*.lovable.app`) antes do cutover

## Recomendação final
Para esta fase pré-cutover, trate como bloqueadores reais de configuração:
1. credenciais básicas do Supabase novo;
2. chaves Gemini diretas;
3. Resend;
4. APP_URL / origins;
5. storage (R2/Cloudinary) se os fluxos operacionais forem exercitados em homologação.

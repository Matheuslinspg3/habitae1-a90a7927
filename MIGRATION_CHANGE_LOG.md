# Migration Change Log

## Data
2026-03-19 (UTC)

## Escopo desta fase
Resolver bloqueadores pré-cutover relacionados a:
- refatoração do gateway Lovable AI nas 6 Edge Functions confirmadas;
- estratégia de migração de autenticação;
- consolidação de secrets e checklist do ambiente destino.

## O que foi alterado

### Código
1. Criado helper compartilhado `supabase/functions/_shared/gemini.ts`.
   - adiciona rotação entre `GOOGLE_AI_KEY_1` e `GOOGLE_AI_KEY_2`;
   - padroniza chamadas Gemini diretas para chat/tool calling;
   - converte imagem remota em data URL para fluxos multimodais;
   - implementa edição/geração de imagem via Gemini direto.

2. Refatorada `supabase/functions/analyze-photo-quality/index.ts`.
   - remove dependência de `LOVABLE_API_KEY`;
   - troca gateway Lovable por Gemini direto;
   - mantém retorno JSON com `quality` e `message`.

3. Refatorada `supabase/functions/validate-document/index.ts`.
   - remove dependência de `LOVABLE_API_KEY`;
   - passa a usar Gemini direto para documentos em imagem;
   - mantém fallback manual para PDF.

4. Refatorada `supabase/functions/contract-ai-fill/index.ts`.
   - troca tool calling do gateway Lovable por Gemini direto OpenAI-compatible.

5. Refatorada `supabase/functions/generate-contract-template/index.ts`.
   - troca text generation do gateway Lovable por Gemini direto.

6. Refatorada `supabase/functions/generate-ad-content/index.ts`.
   - remove fallback Lovable;
   - mantém compatibilidade com `lovable_fallback_enabled`, agora apontando para fallback Gemini direto;
   - passa a usar `text_gemini_key` e/ou `GOOGLE_AI_KEY_1/2`.

7. Refatorada `supabase/functions/generate-ad-image/index.ts`.
   - remove edição de imagem via gateway Lovable;
   - implementa Gemini direto com `gemini-2.0-flash-preview-image-generation`.

### Documentação
8. Criado `AI_GATEWAY_REFACTOR_PLAN.md`.
9. Criado `AUTH_MIGRATION_STRATEGY.md`.
10. Criado `SECRETS_MIGRATION_CHECKLIST.md`.
11. Criado este log `MIGRATION_CHANGE_LOG.md`.

## O que NÃO foi feito
- Não houve deploy.
- Não houve cutover.
- Não houve migração de produção.
- Não houve alteração do fluxo de auth em produção.
- `summarize-lead` não foi refatorada nesta fase por estar fora do bloco dos 6 bloqueadores confirmados.

## Diferenças funcionais residuais registradas
- `generate-ad-image` mudou de modelo Gemini mediado pelo gateway para modelo Gemini direto de image generation/edit.
- fluxos multimodais agora fazem fetch da imagem antes de enviar ao provider direto.
- logs de uso passam a registrar `provider=gemini` nas funções alteradas.

## Pendências antes do cutover
1. Validar funcionalmente as 6 funções em staging/homologação.
2. Endurecer o fluxo operacional de reset em massa.
3. Configurar secrets do ambiente destino.
4. Decidir tratamento final de `summarize-lead`.

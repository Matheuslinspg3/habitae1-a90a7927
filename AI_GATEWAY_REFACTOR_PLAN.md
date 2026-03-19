# AI Gateway Refactor Plan

## Objetivo
Remover o bloqueio pré-cutover causado pelas 6 Edge Functions que dependiam do gateway `ai.gateway.lovable.dev`, sem executar cutover e sem migrar produção.

## Escopo auditado
As 6 funções confirmadas no diagnóstico foram auditadas e refatoradas para provider direto:

| Função | Uso anterior | Nova abordagem | Status |
|---|---|---|---|
| `analyze-photo-quality` | Lovable gateway + Gemini vision | Gemini direto via endpoint OpenAI-compatible + imagem convertida para data URL | Refatorado |
| `validate-document` | Lovable gateway + Gemini vision | Gemini direto via endpoint OpenAI-compatible + signed URL convertido para data URL | Refatorado |
| `contract-ai-fill` | Lovable gateway + tool calling | Gemini direto via endpoint OpenAI-compatible com `tools`/`tool_choice` | Refatorado |
| `generate-contract-template` | Lovable gateway + text generation | Gemini direto via endpoint OpenAI-compatible | Refatorado |
| `generate-ad-content` | fallback Lovable para texto | fallback Gemini direto, reutilizando `text_gemini_key` e `GOOGLE_AI_KEY_1/2` | Refatorado |
| `generate-ad-image` | Lovable gateway com geração/edição de imagem | Gemini direto via `generateContent` com `responseModalities=[TEXT, IMAGE]` | Refatorado |

## Localização das dependências Lovable
### Dependência removida do bloco pré-cutover
- `supabase/functions/analyze-photo-quality/index.ts`
- `supabase/functions/validate-document/index.ts`
- `supabase/functions/contract-ai-fill/index.ts`
- `supabase/functions/generate-contract-template/index.ts`
- `supabase/functions/generate-ad-content/index.ts`
- `supabase/functions/generate-ad-image/index.ts`

### Dependência Lovable adjacente, fora do bloco das 6 funções
- `supabase/functions/summarize-lead/index.ts` ainda usa `AI_GATEWAY_URL` / `AI_GATEWAY_API_KEY` com default legado `ai-gateway.lovable.dev`.
- Essa função **não fazia parte dos 6 bloqueadores confirmados**, então não foi alterada nesta fase para evitar ampliar escopo sem validação funcional adicional.
- Recomendo tratar essa função no próximo lote de hardening, antes do cutover final.

## Abordagem técnica adotada
### 1. Helper compartilhado
Foi criado um helper compartilhado em `supabase/functions/_shared/gemini.ts` para:
- resolver rotação/fallback entre `GOOGLE_AI_KEY_1` e `GOOGLE_AI_KEY_2`;
- aceitar chave preferencial vinda de `ai_provider_config` (`text_gemini_key`) quando existir;
- converter imagens remotas em data URL quando o fluxo usa visão;
- chamar Gemini direto via:
  - `v1beta/openai/chat/completions` para texto, visão e tool calling;
  - `v1beta/models/...:generateContent` para edição/geração de imagem.

### 2. Princípio de compatibilidade
Onde já existia payload em formato OpenAI (`messages`, `tools`, `tool_choice`), a refatoração preservou esse formato para reduzir risco de regressão.

### 3. Reuso do que já existia no projeto
A migração priorizou Google AI / Gemini direto, mas reaproveitou padrões já existentes no repositório:
- chaves globais `GOOGLE_AI_KEY_1` e `GOOGLE_AI_KEY_2`;
- uso pré-existente de Gemini direto em outras funções (`ticket-chat`, `extract-property-pdf`);
- `text_gemini_key` já previsto em `ai_provider_config` para geração de texto.

## Diferenças residuais documentadas
### `generate-ad-image`
- Antes: gateway Lovable com `google/gemini-3-pro-image-preview`.
- Agora: Gemini direto com `gemini-2.0-flash-preview-image-generation`.
- **Diferença residual:** o modelo mudou, então pequenas diferenças visuais são esperadas em composição, fidelidade textual do overlay e estilo de edição.
- **Mitigação:** o prompt foi preservado; os providers alternativos existentes (`openai`, `stability`, `leonardo`, `flux`) continuam disponíveis.

### `analyze-photo-quality` e `validate-document`
- Antes: a imagem era passada por URL ao gateway Lovable.
- Agora: a imagem é baixada e reenviada ao Gemini como data URL.
- **Diferença residual:** aumento pequeno de latência e maior uso de memória para imagens grandes.
- **Mitigação:** a mudança evita dependência do gateway e torna a chamada compatível com o provider direto.

### `generate-ad-content`
- O fallback legado “Lovable” foi substituído por fallback Gemini direto.
- O campo `lovable_fallback_enabled` foi mantido por compatibilidade de schema/UI, mas agora funciona como habilitador do fallback direto para Gemini em vez de Lovable.
- **Diferença residual:** logs e billing passam a registrar `provider=gemini` quando o fallback entra em ação.

## Riscos avaliados
### Risco baixo
- `generate-contract-template`
- `contract-ai-fill`
- `generate-ad-content`

Motivo: payload já estava muito próximo do formato OpenAI-compatible aceito pelo Gemini.

### Risco moderado
- `analyze-photo-quality`
- `validate-document`
- `generate-ad-image`

Motivo: dependem de imagem e podem variar em:
- latência;
- interpretação multimodal;
- formato de retorno de image generation.

## Riscos que justificariam pausa antes do cutover
Parar o rollout desta trilha e validar manualmente se ocorrer qualquer um dos itens abaixo:
1. `generate-ad-image` começar a gerar imagens sem preservar o imóvel original com consistência aceitável.
2. `contract-ai-fill` deixar de retornar `tool_calls.function.arguments` de forma estável.
3. `validate-document` aumentar falsos positivos/negativos para documentos pessoais.
4. quotas/rate limits de `GOOGLE_AI_KEY_1/2` ficarem insuficientes para o volume esperado.

## Secrets necessários após a refatoração
### Obrigatórios para os fluxos refatorados
- `GOOGLE_AI_KEY_1`
- `GOOGLE_AI_KEY_2`

### Opcionais / por configuração
- `text_gemini_key` dentro de `ai_provider_config` para `generate-ad-content`

### Agora dispensável para estas 6 funções
- `LOVABLE_API_KEY`

## Validação recomendada antes do cutover
1. Chamar cada uma das 6 funções em ambiente de staging/homologação.
2. Confirmar logs em `ai_usage_logs` com `provider=gemini` quando aplicável.
3. Validar pelo menos:
   - 3 imagens boas e 3 ruins em `analyze-photo-quality`;
   - 5 documentos reais em `validate-document`;
   - 5 prompts livres em `contract-ai-fill`;
   - 3 templates em `generate-contract-template`;
   - 5 anúncios multicanal em `generate-ad-content`;
   - 5 edições de imagem por estilo em `generate-ad-image`.
4. Medir taxa de erro 429/5xx por chave Google AI.
5. Manter rollback simples: voltar os arquivos desta branch e não remover secrets antigos até o término da validação.

## Recomendação final
O bloqueador pré-cutover referente ao gateway Lovable foi removido **para as 6 Edge Functions confirmadas** com uma abordagem que privilegia:
- segurança operacional;
- compatibilidade com o código existente;
- reversibilidade por Git;
- menor mudança possível de comportamento.

O próximo passo, ainda **antes do cutover**, é validar as 6 funções em staging e tratar `summarize-lead` como dependência residual fora do lote principal.

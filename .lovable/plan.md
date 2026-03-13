

## Plano: Seção "IA" no Developer Dashboard com chaves editáveis

### Contexto

As chaves de API foram removidas da tabela `ai_provider_config` na migração anterior (movidas para secrets). O usuário quer reverter isso: manter as chaves editáveis diretamente no dashboard. Além disso, quer uma seção dedicada "IA" que centralize tudo sobre IA no sistema.

### O que será feito

**1. Migração: Re-adicionar colunas de chaves na tabela `ai_provider_config`**

Adicionar de volta as colunas para armazenar as API keys diretamente na tabela:
- `text_openai_key`, `text_gemini_key`, `text_anthropic_key`, `text_groq_key`
- `image_openai_key`, `image_stability_key`, `image_leonardo_key`, `image_flux_key`

**2. Edge Functions: Ler chaves da tabela em vez de `Deno.env.get()`**

Atualizar `generate-ad-content` e `generate-ad-image` para buscar as chaves da tabela `ai_provider_config` (via `getAIConfig` / `getImageConfig`) em vez de secrets do ambiente.

**3. Nova seção "IA" como tab no Developer Dashboard**

Adicionar uma nova tab "IA" (com ícone `Bot`) no array de tabs do `DeveloperDashboard.tsx`. Essa tab conterá:

- **AIProviderCard** (configuração de provedores) -- com campos de input para as chaves de API editáveis diretamente, com botão de mostrar/esconder senha
- **AIUsageDashboard** (dashboard de uso e custos) -- já existente
- **Últimos logs** -- tabela com os últimos 20 logs de `ai_usage_logs` mostrando provedor, modelo, função, tokens, custo, sucesso/erro

**4. Remover AIProviderCard e AIUsageDashboard da área principal do Dashboard**

Mover esses dois cards da área principal (linhas 68-72) para dentro da nova tab "IA", limpando o layout principal.

**5. Atualizar AIProviderCard com campos de chave editáveis**

Substituir a seção "Chaves necessárias (Secrets)" por inputs reais de texto (tipo password com toggle de visibilidade) para cada chave. As chaves serão salvas via `upsert` na tabela junto com as demais configurações.

### Estrutura da Tab IA

```text
┌─────────────────────────────────────────┐
│  Provedores de IA (AIProviderCard)      │
│  - Seleção texto/imagem                 │
│  - Campos de API Key editáveis          │
│  - Toggle fallback Lovable              │
├─────────────────────────────────────────┤
│  Dashboard de Uso (AIUsageDashboard)    │
│  - Métricas, gráfico por dia, custos    │
├─────────────────────────────────────────┤
│  Logs Recentes (tabela)                 │
│  - Últimas 20 chamadas com detalhes     │
└─────────────────────────────────────────┘
```

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `ai_provider_config` (migração) | Adicionar colunas de chave |
| `src/pages/developer/DeveloperDashboard.tsx` | Adicionar tab "IA", remover cards da área principal |
| `src/components/developer/AIProviderCard.tsx` | Adicionar inputs de chaves editáveis |
| `supabase/functions/generate-ad-content/index.ts` | Ler chaves da tabela |
| `supabase/functions/generate-ad-image/index.ts` | Ler chaves da tabela |
| Novo: `src/components/developer/AILogsTable.tsx` | Tabela de logs recentes |


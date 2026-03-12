

## Plano: Verificação CRECI via ImobiSec

### Problema
A API BuscaCRECI retorna erros 502 constantemente. O site CRECI-SP tem reCAPTCHA. Precisamos de uma fonte confiavel.

### Solucao

Usar o **ImobiSec** (imobisec.com.br) com a seguinte estrategia em 2 etapas:

**Etapa 1 - Busca**: Usar o **Firecrawl** (conector ja disponivel) para fazer uma web search `site:imobisec.com.br CRECI {numero} {estado}` e encontrar a URL da pagina de detalhe do corretor/imobiliaria.

**Etapa 2 - Scraping do status**: Fazer um `fetch` direto na URL de detalhe do ImobiSec (paginas SSR, sem captcha) e parsear o HTML para extrair nome, tipo (PF/PJ) e status (Ativo/Inativo/Cancelado/Suspenso).

### Mudancas

**1. Conectar Firecrawl** (conector)
- Vincular o conector Firecrawl ao projeto para ter a `FIRECRAWL_API_KEY` disponivel nas edge functions.

**2. Reescrever `supabase/functions/verify-creci/index.ts`**
- Remover toda logica BuscaCRECI (submit, poll, getDetails).
- Nova funcao `searchImobiSec(creci, state, type)`: usa Firecrawl search API com query `site:imobisec.com.br {creci}-{F|J} {state}`.
- Nova funcao `scrapeImobiSecDetail(url)`: fetch direto no HTML da pagina de detalhe, regex/parse para extrair status do registro.
- Logica de selecao: se o CRECI no perfil contiver letra (F/J/E), usar para filtrar PF/PJ nos resultados; caso contrario, inferir de contexto.
- Manter a comparacao de nome por similaridade (Dice coefficient).
- Manter a atualizacao do profile (creci_verified, creci_verified_name, creci_verified_at).

**3. Atualizar `src/components/settings/VerificationSection.tsx`**
- Adicionar campo opcional para **letra do registro** (F/J/E) via Select, ao lado do estado.
- Enviar `creci_type` no body da chamada (`F`, `J` ou `E`).
- Atualizar mensagens de progresso.

### Fluxo tecnico

```text
Frontend                    Edge Function                   Firecrawl        ImobiSec
   |                             |                              |               |
   |-- invoke verify-creci ----->|                              |               |
   |   {creci, state, type}      |                              |               |
   |                             |-- POST /v1/search ---------->|               |
   |                             |   "site:imobisec.com.br      |               |
   |                             |    50975-J SP"               |               |
   |                             |<-- URLs encontradas ---------|               |
   |                             |                              |               |
   |                             |-- fetch detail page ---------|-------------->|
   |                             |<-- HTML (SSR, sem captcha) --|---------------|
   |                             |                              |               |
   |                             |   parse: nome, status        |               |
   |                             |   compare nome (similarity)  |               |
   |                             |   update profile se ok       |               |
   |<-- resultado ---------------|                              |               |
```

### Parsing do HTML de detalhe

As paginas de detalhe do ImobiSec retornam HTML MUI com chips contendo:
- Nome: tag `<h1>` dentro de `MuiCardHeader`
- Status: chip com texto "Ativo", "Inativo", "Cancelado" ou "Suspenso"
- Tipo: chip "Pessoa Física" ou "Pessoa Jurídica"
- Estado: chip com nome do estado

Regex simples no HTML para extrair esses valores.

### Custos
- Firecrawl search: ~1 credito por verificacao (apenas search, sem scrape completo).
- Edge function: consumo minimo de Cloud (uma execucao rapida).


# Confirmações Técnicas do Lovable — Impacto no Plano de Migração
## Habitae: Lovable Cloud → Supabase Próprio

**Versão**: 1.0
**Data**: 2026-03-18
**Contexto**: Este documento registra as confirmações técnicas obtidas junto ao Lovable após a
criação dos documentos de migração v1.0, e detalha o impacto de cada confirmação no plano.

---

## Índice

1. [O Que Foi Confirmado](#1-o-que-foi-confirmado)
2. [O Que Deixa de Ser Dúvida](#2-o-que-deixa-de-ser-dúvida)
3. [O Que Ainda É Risco Real](#3-o-que-ainda-é-risco-real)
4. [Impacto no Plano de Execução](#4-impacto-no-plano-de-execução)
5. [Impacto nas Edge Functions de AI](#5-impacto-nas-edge-functions-de-ai)
6. [Impacto na Estratégia de Export/Import](#6-impacto-na-estratégia-de-exportimport)
7. [Impacto no Cutover](#7-impacto-no-cutover)
8. [Impacto no Rollback](#8-impacto-no-rollback)

---

## 1. O Que Foi Confirmado

### C1 — LOVABLE_API_KEY não é portável

**Confirmação**: `LOVABLE_API_KEY` é auto-provisionada exclusivamente pelo Lovable Cloud.
O endpoint `ai.gateway.lovable.dev` é infraestrutura proprietária do Lovable — inacessível fora
da plataforma. Não há plano enterprise, portabilidade ou exceção. Não há como transferir a key.

**Status v1.0**: "talvez funcione com fallback" / "verificar"
**Status v1.1**: ⛔ Definitivamente não portável — audit obrigatório das 7 funções afetadas

---

### C2 — pg_net trigger com hardcoded fallback (CRÍTICO NOVO)

**Confirmação**: A migration mais recente (`20260317204734_fca31fcd.sql`) reintroduz fallback
hardcoded para o projeto antigo (`aiflfkkjitvsyszwdfga`) na função `trigger_push_on_notification`.
A função lê o GUC `app.settings.supabase_url` primeiro (correto), mas cai no hardcoded se o GUC
não estiver configurado.

**Impacto**: Se `ALTER DATABASE postgres SET app.settings.supabase_url` não for executado após
as migrations, o trigger de push continuará enviando requisições ao projeto ANTIGO — com a URL
e anon key antigas hardcoded no código SQL.

**Solução obrigatória**:
```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://NOVO_PROJECT_ID.supabase.co';
ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'NOVO_ANON_KEY';
```

---

### C3 — pg_cron tem zero jobs definidos

**Confirmação**: A extensão `pg_cron` está instalada via migration
(`20260305044221_31cb21cf.sql`), mas nenhum `cron.schedule()` foi encontrado em nenhuma migration
ou edge function. Não há jobs a recriar manualmente.

**Ação necessária**: Apenas habilitar a extensão no Dashboard do novo Supabase
(Settings → Extensions → pg_cron). Nenhum job adicional.

---

### C4 — main.tsx redirect: manter, não remover

**Confirmação**: `src/main.tsx` (linhas 72-83) contém redirect client-side:
`habitae1.lovable.app` → `portadocorretor.com.br`. Este redirect é BENÉFICO — protege usuários
que acessem o URL antigo após a migração. Também confirma o domínio de produção real.

**Decisão**: MANTER o redirect em todos os cenários (go-live e rollback). NÃO reverter.

---

### C5 — Domínio de produção confirmado

**Confirmação**: Via `src/main.tsx`, o domínio de produção real é `portadocorretor.com.br`.
Todos os documentos v1.1 usam este domínio (substituindo o placeholder anterior).

---

### C6 — Método de export preferido: /manutencao

**Confirmação**: O método preferido pelo Lovable para export é via endpoint `/manutencao`
com os modos:
- `mode=schema` — schema completo sem dados
- `mode=auth` — usuários de auth.users
- `mode=table&table=NAME` — dados de tabela específica

`pg_dump` é alternativa válida se `/manutencao` falhar.

---

### C7 — Ordem de importação confirmada

**Confirmação**: A ordem correta para importação é:
```
Extensions → Enums → Tabelas sem FKs → Auth users → Dados → Foreign Keys →
RLS + Functions + Triggers
```

Esta ordem garante que FKs para `auth.users` não falhem e que o RLS não bloqueie a importação.

---

### C8 — Stack Supabase padrão — 100% compatível

**Confirmação**: Auth, RLS, Edge Functions Deno, `config.toml` e `_shared/` são 100%
compatíveis com Supabase padrão. Não há middleware oculto, camada proprietária entre
o código e o Supabase, nem configuração especial além do que está no repositório.

---

### C9 — auth.users exportável via /manutencao?mode=auth

**Confirmação**: O endpoint `/manutencao` com `mode=auth` exporta os usuários do `auth.users`,
incluindo `bcrypt_hash` das senhas. Isso permite migração sem forçar reset de senha para todos.

---

### C10 — Tokens OAuth (Meta, RD Station) não são portáveis

**Confirmação**: Tokens OAuth armazenados em tabelas (`meta_tokens`, `rd_station_settings`) são
vinculados ao redirect_uri do projeto antigo. Tokens existentes podem ser migrados como dados,
mas precisarão ser re-autorizados pelos usuários se o redirect_uri mudar.

---

## 2. O Que Deixa de Ser Dúvida

| Dúvida v1.0 | Resposta confirmada |
|------------|---------------------|
| Stack Supabase é padrão? | ✅ Sim — 100% compatível, sem middleware oculto |
| Auth é padrão Supabase? | ✅ Sim — bcrypt padrão, exportável e reimportável |
| RLS nas migrations é suficiente? | ✅ Sim — policies nas migrations, não no Lovable Cloud |
| pg_cron tem jobs a recriar? | ✅ Não — zero `cron.schedule()` no projeto inteiro |
| Domínio de produção? | ✅ `portadocorretor.com.br` (confirmado via main.tsx) |
| Export de auth.users possível? | ✅ Via `/manutencao?mode=auth` |
| LOVABLE_API_KEY portável? | ❌ Definitivamente não — endpoint proprietário |
| pg_net trigger URL configurável? | ✅ Via GUC settings — mas obrigatório configurar |

---

## 3. O Que Ainda É Risco Real

### R1 — LOVABLE_API_KEY: 6 funções sem fallback auditado

Das 7 funções que usam `LOVABLE_API_KEY`, apenas `validate-document` tem fallback confirmado
(`{skipped: true}`). As outras 6 precisam de auditoria de código para confirmar comportamento
sem a key. **Risco**: Podem retornar erro 500 silenciosamente ou explicitamente.

### R2 — pg_net hardcoded URL se GUC não configurado

Se o step `ALTER DATABASE SET` for esquecido ou falhar, o trigger de push enviará requisições
ao projeto antigo. As notificações push serão perdidas (sem erro visível no frontend).

### R3 — User UUID remapping: 15+ colunas FK afetadas

UUIDs mudam entre projetos Supabase. Script de mapeamento e UPDATE em múltiplas colunas
é obrigatório. Erros no mapeamento causam FK violations ou dados órfãos.

### R4 — Tokens OAuth expirados pós-migração

Usuários que tinham contas Meta Ads ou RD Station conectadas precisarão re-autorizar após
a migração. Comunicação proativa necessária.

### R5 — Janela de manutenção: delta de dados

Dados criados entre início da exportação e ativação do modo manutenção podem ser perdidos
ou causar conflitos. Minimizar janela e confirmar modo manutenção antes de qualquer import.

---

## 4. Impacto no Plano de Execução (MIGRATION_EXECUTION_PLAN.md)

| Seção afetada | Mudança v1.0 → v1.1 |
|--------------|---------------------|
| Blokers | +B6 (pg_net hardcoded URL) e +B7 (LOVABLE_API_KEY audit) |
| Fase 0 | +Step 0.4 (decisão LOVABLE_API_KEY) e +Step 0.5 (pg_cron/pg_net no Dashboard) |
| Fase 1 (Export) | `/manutencao` como método primário; pg_dump como fallback |
| Fase 2 (Migrations) | +Wave 0 explícita para Extensions; ordem ajustada |
| Fase 2 (pós-apply) | +Step 2.4: `ALTER DATABASE SET` obrigatório |
| Fase 3 (Dados) | Ordem: sem FKs → auth users → dados → FKs → RLS+Functions+Triggers |
| Timeline D-Day | Passo de pg_net GUC às 04:20 adicionado explicitamente |
| Status | "APROVADO" → "⚠️ PENDENTE" (4 pré-requisitos pendentes) |

---

## 5. Impacto nas Edge Functions de AI (EDGE_FUNCTIONS_DEPLOYMENT_PLAN.md)

| Mudança | Detalhe |
|---------|---------|
| GRUPO G na tabela de functions | ⚠️ → "❌ NÃO PORTÁVEL — audit obrigatório" |
| Seção 4 (estratégia LOVABLE_API_KEY) | Reescrita completamente — sem linguagem de "opção" |
| Decisão binária | Code fix (Opção A) ou degradação documentada (Opção B) — obrigatória antes do cutover |
| Risco 5 adicionado | pg_net trigger com hardcoded fallback e solução via ALTER DATABASE SET |
| Header | Nota de stack confirmada: "100% compatível, sem middleware oculto" |

**Funções que requerem auditoria de código** (se Opção A):
- `generate-contract-template`
- `summarize-lead`
- `analyze-photo-quality`
- `contract-ai-fill`
- `extract-property-pdf`
- `test-ai-connection`

**Providers disponíveis como substitutos**:
- `GROQ_API_KEY_1/2` — Groq (llama3, mixtral)
- `GOOGLE_AI_KEY_1/2` — Gemini via `generativelanguage.googleapis.com`
- `AI_GATEWAY_URL + AI_GATEWAY_API_KEY` — OpenRouter (proxy OpenAI-compatible)
- `OPENAI_IMAGE_API_KEY` — OpenAI (para funções de imagem)

---

## 6. Impacto na Estratégia de Export/Import

### Método de export atualizado

**Antes (v1.0)**: pg_dump como método único
**Depois (v1.1)**: `/manutencao` como método primário, pg_dump como fallback

Sequência de export via `/manutencao`:
```
1. mode=schema                    → Schema completo
2. mode=auth                      → auth.users com bcrypt_hash
3. mode=table&table=organizations → Tabelas sem FKs primeiro
4. mode=table&table=profiles      → Após auth users importados
5. [... demais tabelas na ordem correta]
```

### Ordem de importação atualizada (Lovable confirmou)

```
Wave 0: Extensions (pg_cron, pg_net) — via Dashboard, não migration
Wave 1: Enums
Wave 2: Tabelas sem FKs (organizations, subscription_plans, etc.)
Wave 3: Auth users (auth.users — com bcrypt_hash)
Wave 4: Dados das tabelas (user_id remapeado via script)
Wave 5: Foreign Keys (habilitar constraints)
Wave 6: RLS + Functions + Triggers
```

---

## 7. Impacto no Cutover (CUTOVER_STRATEGY.md)

| Mudança | Detalhe |
|---------|---------|
| Critério go/no-go | +"GUC pg_net configurado e validado" como item obrigatório |
| Critério go/no-go | +"pg_cron habilitado no Dashboard" como item 🟡 |
| Critério go/no-go | +"Decisão LOVABLE_API_KEY documentada (A ou B)" |
| STEP 5.5 adicionado | Validação obrigatória dos GUC settings antes do go-live |
| STEP 5.5 (smoke test) | INSERT em notifications → confirmar que trigger pg_net disparou para novo projeto |
| Domínio | Todas as ocorrências de placeholder → `portadocorretor.com.br` |

### Step obrigatório no cutover (após `supabase db push`):

```sql
-- OBRIGATÓRIO — Executar imediatamente após aplicar as migrations
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://NOVO_PROJECT_ID.supabase.co';
ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'NOVO_ANON_KEY';
-- Verificar:
SELECT current_setting('app.settings.supabase_url');
```

---

## 8. Impacto no Rollback (ROLLBACK_PLAN.md)

| Mudança | Detalhe |
|---------|---------|
| Seção 4 (preservado) | +Nota: GUC settings do projeto antigo nunca foram alterados — trigger continua apontando para `aiflfkkjitvsyszwdfga` (correto para rollback) |
| ROLLBACK STEP 4.5 | +Passo opcional: reverter GUC settings no novo projeto (boa prática — evita que trigger continue chamando funções do projeto em manutenção) |
| Seção "não reverter" | main.tsx redirect — NÃO reverter mesmo em rollback (continua benéfico) |
| Seção 8 (pós-rollback) | +Documentar que GUC do projeto antigo está OK (não precisa ação) |

**Nota sobre rollback e pg_net**: No projeto antigo, o trigger `trigger_push_on_notification`
aponta para `aiflfkkjitvsyszwdfga.supabase.co` (URL hardcoded + GUC nunca alterado no antigo).
Isso significa que o rollback **restaura automaticamente** o comportamento correto do trigger
sem nenhuma ação adicional.

---

*Documento versão 1.0 — 2026-03-18*
*Parte da série de documentação de migração Lovable Cloud → Supabase Próprio*
*Documentos relacionados: [PRE_EXECUTION_BLOCKERS.md](./PRE_EXECUTION_BLOCKERS.md)*

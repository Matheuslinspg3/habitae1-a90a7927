# Plano de Execução de Migração — Habitae
## Lovable Cloud → Supabase Próprio

**Versão**: 1.1
**Data de elaboração**: 2026-03-18
**Última revisão**: 2026-03-18 (incorporação de confirmações técnicas do Lovable)
**Responsável**: Engenharia Backend
**Status**: ⚠️ PENDENTE — verificar PRE_EXECUTION_BLOCKERS.md antes de executar

---

## Índice

1. [Visão Geral e Decisão Estratégica](#1-visão-geral-e-decisão-estratégica)
2. [Pré-requisitos Obrigatórios](#2-pré-requisitos-obrigatórios)
3. [Mapeamento de Riscos](#3-mapeamento-de-riscos)
4. [Fase 0 — Preparação do Ambiente](#fase-0--preparação-do-ambiente)
5. [Fase 1 — Exportação do Banco de Dados](#fase-1--exportação-do-banco-de-dados)
6. [Fase 2 — Aplicação de Migrations](#fase-2--aplicação-de-migrations)
7. [Fase 3 — Migração de Dados](#fase-3--migração-de-dados)
8. [Fase 4 — Migração de Usuários (auth.users)](#fase-4--migração-de-usuários-authusers)
9. [Fase 5 — Configuração de Auth e RLS](#fase-5--configuração-de-auth-e-rls)
10. [Fase 6 — Deploy de Edge Functions](#fase-6--deploy-de-edge-functions)
11. [Fase 7 — Configuração de Secrets](#fase-7--configuração-de-secrets)
12. [Fase 8 — Cutover](#fase-8--cutover)
13. [Fase 9 — Validação Final](#fase-9--validação-final)
14. [Ordem Sequencial de Execução](#14-ordem-sequencial-de-execução)

---

## 1. Visão Geral e Decisão Estratégica

### 1.1 Escopo

| Item | Quantidade |
|------|-----------|
| Migrations SQL | 206 |
| Edge Functions | 68 |
| Funções com `verify_jwt = false` | 35 (explícito no config.toml) |
| Funções usando SERVICE_ROLE_KEY | ~46 |
| Funções dependentes de LOVABLE_API_KEY | 7 — **NÃO portável** (ver Seção 3 + PRE_EXECUTION_BLOCKERS.md) |
| Tabelas no schema public | ~47 |
| Jobs pg_cron | 0 (extensão instalada, nenhum job definido — habilitar no Dashboard) |
| Triggers com pg_net | 1 (`trigger_push_on_notification`) — requer `ALTER DATABASE SET` pós-migration |
| Domínio de produção | `portadocorretor.com.br` (confirmado via `src/main.tsx:74`) |
| Integrações externas críticas | 8 (Asaas, Meta, RD Station, OneSignal, R2, Cloudinary, WhatsApp, Imobzi) |

### 1.2 Estratégia Escolhida: Big Bang com Janela de Manutenção

**Decisão**: Big Bang + janela de manutenção de 4-6 horas.

**Justificativa**:
- Shadow migration é inviável: `auth.uid()` e UUIDs de usuários mudam entre projetos Supabase. Replicar escrita em tempo real exigiria rewriting de toda a camada auth.
- Migração incremental é inviável: RLS depende do projeto Supabase específico (JWT secret diferente). Dados no novo projeto não seriam acessíveis com tokens do projeto antigo.
- Big bang é seguro porque: o projeto antigo permanece **vivo e funcionando como rollback** durante toda a janela. Reverter é trivial (trocar 3 env vars no frontend).
- Volume de dados é gerenciável: a function `export-database` já está implementada e testada.

**Janela recomendada**: Domingo 02:00-08:00 (horário de menor uso).

### 1.3 Projeto atual (Lovable Cloud)

```
Project ID : aiflfkkjitvsyszwdfga
URL        : https://aiflfkkjitvsyszwdfga.supabase.co
Anon Key   : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (ver .env)
```

---

## 2. Pré-requisitos Obrigatórios

### Antes de iniciar qualquer fase:

- [ ] **Conta Supabase criada** — novo projeto na região `South America (São Paulo)` (sa-east-1)
- [ ] **Credenciais do novo projeto anotadas** em local seguro (não em código):
  - `NEW_SUPABASE_URL`
  - `NEW_SUPABASE_ANON_KEY`
  - `NEW_SUPABASE_SERVICE_ROLE_KEY`
  - `NEW_SUPABASE_PROJECT_ID`
  - `NEW_SUPABASE_DB_PASSWORD`
- [ ] **Supabase CLI instalado**: `npm i -g supabase` (versão ≥ 1.150)
- [ ] **Bun instalado**: versão ≥ 1.0
- [ ] **psql instalado**: para execução direta de SQL
- [ ] **Acesso ao painel Asaas** (para atualizar webhook URL)
- [ ] **Acesso ao Facebook App Developers** (para atualizar redirect_uri)
- [ ] **Acesso ao RD Station Marketplace** (para atualizar redirect_uri)
- [ ] **Acesso ao painel OneSignal** (para confirmar App ID)
- [ ] **Backup completo confirmado** do projeto Lovable (git push feito, DB exportado)
- [ ] **Comunicação aos usuários** enviada (aviso de manutenção com horário)
- [ ] **Time disponível** durante toda a janela (2+ engenheiros)

---

## 3. Mapeamento de Riscos

### 🔴 BLOCKERS (impedem execução sem resolução prévia)

| ID | Risco | Impacto | Mitigação |
|----|-------|---------|-----------|
| B1 | User UUIDs mudam entre projetos Supabase | Quebra total do RLS e relacionamentos FK | Script de mapeamento old_id→new_id + UPDATE em 15+ colunas |
| B2 | **LOVABLE_API_KEY definitivamente não portável** — `ai.gateway.lovable.dev` é endpoint proprietário do Lovable Cloud, inacessível em Supabase próprio. Apenas `validate-document` tem fallback confirmado em código. 6 funções sem fallback auditado. | Features de IA degradadas; possível crash em funções sem fallback | Decisão obrigatória: (a) auditar e substituir por providers diretos (Groq, Gemini, OpenAI) **antes do cutover**, ou (b) aceitar degradação documentada. Provider `"lovable"` nunca usar fora do Lovable Cloud. |
| B3 | Meta OAuth redirect_uri deve ser atualizado ANTES do cutover | OAuth Meta quebra | Atualizar no Facebook App Developers com antecedência de 24h |
| B4 | RD Station OAuth redirect_uri deve ser atualizado ANTES do cutover | OAuth RD Station quebra | Atualizar no painel RD Station com antecedência de 24h |
| B5 | Asaas webhook URL deve ser atualizado no painel Asaas | Cobranças sem processamento | Atualizar no painel Asaas durante a janela de cutover |
| B6 | **pg_net hardcoded fallback** — `20260317204734_fca31fcd.sql` (último migration) define `trigger_push_on_notification` com fallback hardcoded para `aiflfkkjitvsyszwdfga.supabase.co` e anon key antiga embutida. Sem GUC configurado, push vai para projeto ANTIGO. | Push notifications enviadas ao projeto errado silenciosamente | Após aplicar migrations: `ALTER DATABASE postgres SET app.settings.supabase_url = 'https://NOVO_ID.supabase.co'; ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'NOVO_ANON_KEY';` — o trigger checa GUC primeiro, fallback só ativa se GUC não for configurado. |
| B7 | pg_cron extension instalada mas não habilitada via Dashboard | Jobs SQL agendados falham silenciosamente (não há jobs definidos atualmente, mas extensão precisa estar ativa) | Habilitar pg_cron no Dashboard do novo projeto: Settings → Extensions → pg_cron → Enable |

### 🟠 ALTO RISCO

| ID | Risco | Impacto | Mitigação |
|----|-------|---------|-----------|
| A1 | 35 funções com `verify_jwt = false` fazem validação manual inconsistente | Acesso não autorizado a dados | Auditar cada função antes do deploy; confirmar que todas usam SERVICE_ROLE com validação interna |
| A2 | RLS depende de `auth.uid()` — JWT secret diferente no novo projeto | Queries retornam 0 rows ou erro | Testar acesso com usuário de teste ANTES de abrir para produção |
| A3 | Delta de dados entre exportação inicial e cutover | Perda de dados criados no intervalo | Exportar delta imediatamente antes do cutover; janela de manutenção é o controle |
| A4 | OAuth tokens em DB (rd_station_settings, ad_accounts) migrados mas potencialmente expirados | Meta/RD Ads sem dados | Planejar re-autorização OAuth pós-migração; notificar usuários afetados |
| A5 | wa-worker (WhatsApp/Easypanel) tem EDGE_BASE_URL hardcoded | WhatsApp não funciona | Atualizar variável no Easypanel durante janela |

### 🟡 MÉDIO RISCO

| ID | Risco | Impacto | Mitigação |
|----|-------|---------|-----------|
| M1 | Service Workers PWA em cache nos browsers | Usuários com comportamento errático por 24h | Incrementar SW version; forçar hard reload via OneSignal notification |
| M2 | OneSignal push_subscriptions migradas mas device tokens podem ter expirado | Push falha silenciosamente | Aceitar; tokens se renovam na próxima sessão do usuário |
| M3 | Migrations com dependências circulares | Erro na execução | Testar em staging ANTES da janela de produção |
| M4 | `supabase/config.toml` com project_id antigo | Deploy de functions falha | Atualizar project_id antes do deploy |
| M5 | `src/main.tsx:72-83` redireciona `habitae1.lovable.app` → `portadocorretor.com.br` | Este redirect é BENÉFICO e deve ser mantido — protege usuários que acessem URL antiga após migração. Verificar que `portadocorretor.com.br` é o domínio de produção correto. | Confirmar domínio antes do go-live. Não remover o redirect. |

### 🟢 BAIXO RISCO

| ID | Risco | Impacto | Mitigação |
|----|-------|---------|-----------|
| L1 | URLs de imagens (Cloudinary/R2) | Nenhum — storage é externo | Nenhuma ação necessária |
| L2 | Google Maps API key | Restrita por domínio — funciona se domínio não muda | Verificar domínio |
| L3 | Imobzi API key (armazenada em imobzi_settings) | Migrada junto com dados | Testar import após migração |

---

## Fase 0 — Preparação do Ambiente

**Duração estimada**: 2h (pode ser feito dias antes)

### 0.1 Criar e configurar novo projeto Supabase

```bash
# Via Supabase CLI (authenticate first)
supabase login

# Criar projeto (ou criar via dashboard web)
# Região: sa-east-1 (São Paulo)
# Anotar: project_id, url, anon_key, service_role_key, db_password
```

Via Dashboard:
1. Acesse https://supabase.com/dashboard
2. New Project → South America (São Paulo) → Definir senha forte
3. Aguardar provisionamento (~2 min)
4. Copiar: Project URL, anon key, service_role key

### 0.2 Atualizar config.toml com novo project_id

```bash
# Editar /supabase/config.toml
# Linha 1: project_id = "NOVO_PROJECT_ID"
```

> ⚠️ AÇÃO MANUAL obrigatória antes de qualquer deploy de functions.

### 0.3 Fazer link do CLI ao novo projeto

```bash
cd /home/user/habitae1-a90a7927
supabase link --project-ref NOVO_PROJECT_ID
# Informar DB password quando solicitado
```

### 0.4 Decisão obrigatória: substituição do LOVABLE_API_KEY

> ⛔ LOVABLE_API_KEY **não é portável**. O endpoint `ai.gateway.lovable.dev` é
> propriedade do Lovable Cloud e não estará acessível no novo ambiente Supabase.
> Esta é uma dependência técnica com impacto direto em 7 edge functions de IA.

**Auditoria prévia obrigatória**: verificar cada uma das 7 funções afetadas:
- `validate-document` — fallback confirmado: retorna `{skipped: true}` se sem key
- `generate-contract-template` — **pendente audit**
- `summarize-lead` — **pendente audit**
- `analyze-photo-quality` — **pendente audit**
- `contract-ai-fill` — **pendente audit**
- `extract-property-pdf` — **pendente audit**
- `test-ai-connection` — retorna status de providers; sem LOVABLE_API_KEY o provider "lovable" aparece como falho, sem crash

**Decisão A — Substituir por providers diretos (recomendado)**:
```bash
# Usar GROQ_API_KEY_1/2 (Groq) e GOOGLE_AI_KEY_1/2 (Gemini) já configurados.
# O código de cada função precisa ser auditado para remover referências a
# ai.gateway.lovable.dev e substituir pela lógica de provider direto.
# Nunca usar provider = "lovable" em produção fora do Lovable Cloud.
```

**Decisão B — Aceitar degradação temporária**:
```
Condição: confirmar via auditoria que cada função falha graciosamente (não 500).
validate-document → {skipped: true} ✅ confirmado
demais → verificar antes de aceitar degradação
Prazo de resolução definitiva: até 7 dias pós-go-live.
```

**AÇÃO MANUAL**: marcar a decisão tomada aqui antes de prosseguir:
`[ ] Decisão A — code fix planejado  [ ] Decisão B — degradação aceita e auditada`

### 0.5 Habilitar extensões no novo projeto (Dashboard)

> As extensões `pg_cron` e `pg_net` são instaladas via migrations, mas em projetos
> Supabase gerenciados precisam ser habilitadas também via Dashboard.

```
Supabase Dashboard → Database → Extensions:
  ✅ pg_cron  → Enable
  ✅ pg_net   → Enable (normalmente já ativo em Supabase cloud)
  ✅ uuid-ossp → Verificar se ativo (necessário para gen_random_uuid())
  ✅ pgcrypto → Verificar se ativo
```

> pg_cron: nenhum job agendado existe atualmente. Extensão apenas precisa estar ativa.

### 0.6 Atualizar redirect_uris nos serviços externos

**Meta (Facebook App Developers)** — FAZER COM 24H DE ANTECEDÊNCIA:
```
1. Acessar developers.facebook.com
2. Seu App → Settings → Facebook Login → Valid OAuth Redirect URIs
3. Adicionar: https://NOVO_PROJECT_ID.supabase.co/functions/v1/meta-oauth-callback
4. Manter URI antiga ativa até go-live confirmado
```

**RD Station Marketplace** — FAZER COM 24H DE ANTECEDÊNCIA:
```
1. Acessar developers.rdstation.com
2. Sua App → Credenciais → Redirect URI
3. Adicionar: https://NOVO_PROJECT_ID.supabase.co/functions/v1/rd-station-oauth-callback
4. Manter URI antiga ativa até go-live confirmado
```

---

## Fase 1 — Exportação do Banco de Dados

**Duração estimada**: 30-60 min
**Quando**: 1-2 dias antes da janela de manutenção (para validação) + repetir no início da janela

> **Método primário recomendado pelo Lovable**: usar o endpoint `/manutencao` do app.
> pg_dump é o método alternativo caso a exportação via app falhe.

### 1.0 Exportar via /manutencao (método PRIMÁRIO)

```bash
# Acessar o app como usuário com role "developer" ou "admin"
# URL: https://portadocorretor.com.br/manutencao

# Modo 1 — Exportar schema (DDL: enums, tabelas, funções, triggers, policies, indexes)
curl -X POST \
  "https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/export-database" \
  -H "Authorization: Bearer $OLD_SERVICE_ROLE_KEY" \
  -d '{"mode": "schema"}' \
  -o export_schema.json

# Modo 2 — Exportar usuários auth
curl -X POST \
  "https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/export-database" \
  -H "Authorization: Bearer $OLD_SERVICE_ROLE_KEY" \
  -d '{"mode": "auth"}' \
  -o export_auth.json

# Modo 3 — Exportar tabela por tabela (repetir para cada tabela necessária)
for TABLE in organizations subscription_plans profiles user_roles properties leads contracts commissions invoices transactions; do
  curl -X POST \
    "https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/export-database" \
    -H "Authorization: Bearer $OLD_SERVICE_ROLE_KEY" \
    -d "{\"mode\": \"table\", \"table\": \"$TABLE\"}" \
    -o "export_table_${TABLE}.json"
  echo "Exportado: $TABLE"
done
```

**Ordem de export recomendada pelo Lovable**:
1. Extensions (via migration — automático)
2. Enums
3. Tabelas sem FKs
4. Auth users
5. Dados (tabela por tabela)
6. Foreign Keys
7. RLS + Functions + Triggers

### 1.1 Exportar schema completo via pg_dump (método ALTERNATIVO)

```bash
# Conectar ao DB do projeto Lovable (obter connection string do dashboard)
# Dashboard → Settings → Database → Connection string (modo URI)

LOVABLE_DB_URL="postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"

# Exportar schema completo (DDL)
pg_dump "$LOVABLE_DB_URL" \
  --schema-only \
  --no-owner \
  --no-acl \
  --schema=public \
  -f schema_export.sql

# Exportar apenas dados (sem schema)
pg_dump "$LOVABLE_DB_URL" \
  --data-only \
  --no-owner \
  --no-acl \
  --schema=public \
  --exclude-table=schema_migrations \
  -f data_export.sql
```

### 1.2 Exportar usuários auth.users

```bash
# Exportar usuários (sem senhas — impossível exportar bcrypt hashes entre projetos)
psql "$LOVABLE_DB_URL" -c \
  "COPY (
    SELECT id, email, email_confirmed_at, created_at,
           raw_user_meta_data, raw_app_meta_data
    FROM auth.users
    WHERE deleted_at IS NULL
  ) TO STDOUT WITH CSV HEADER" \
  > auth_users_export.csv

# Contar usuários exportados
wc -l auth_users_export.csv
```

### 1.3 Exportar via edge function (alternativa para dados de referência)

```bash
# Acessar /manutencao no app → "Exportar Banco de Dados"
# Ou chamar diretamente:
curl -X POST \
  "https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/export-database" \
  -H "Authorization: Bearer $LOVABLE_ANON_KEY" \
  -o database_export.json

# Validar arquivo gerado
cat database_export.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('Tabelas:', len(d.get('tables',{})))"
```

### 1.4 Anotar contagens de controle

```sql
-- Executar no projeto antigo e guardar os números para comparação
SELECT
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## Fase 2 — Aplicação de Migrations

**Duração estimada**: 30-60 min
**Pré-requisito**: config.toml atualizado com novo project_id, CLI linked ao novo projeto

### 2.1 Verificar migrations disponíveis

```bash
ls -la supabase/migrations/ | wc -l
# Esperado: 206 arquivos .sql

# Verificar ordem cronológica (primeiros e últimos)
ls supabase/migrations/ | sort | head -5
ls supabase/migrations/ | sort | tail -5
```

### 2.2 Aplicar todas as migrations via CLI

```bash
# Opção A — via Supabase CLI (recomendado — aplica na ordem correta)
supabase db push --linked

# Opção B — se CLI falhar, aplicar via psql direto
NEW_DB_URL="postgresql://postgres.NOVO_PROJECT_ID:NOVA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"

for migration in $(ls supabase/migrations/*.sql | sort); do
  echo "Aplicando: $migration"
  psql "$NEW_DB_URL" -f "$migration"
  if [ $? -ne 0 ]; then
    echo "ERRO em: $migration — PARAR E INVESTIGAR"
    break
  fi
done
```

### 2.3 Grupos lógicos das migrations (em caso de erro parcial)

Se houver necessidade de aplicar em partes, a ordem confirmada pelo Lovable é:

```
WAVE 0 — Extensions (pg_cron, pg_net, uuid-ossp, pgcrypto) — habilitar no Dashboard também
WAVE 1 — Enums e tipos base (migrations 2026-01-28)
WAVE 2 — Tabelas sem FKs (organizations, subscription_plans, property_types, lead_stages)
WAVE 3 — Auth users (importar via Fase 4 ANTES dos dados que referenciam user_id)
WAVE 4 — Dados das tabelas principais (profiles, user_roles, properties, leads...)
WAVE 5 — Foreign Keys e constraints relacionais
WAVE 6 — RLS + Functions + Triggers (incluindo trigger_push_on_notification com pg_net)
WAVE 7 — Indexes
```

> As migrations do Lovable são nomeadas com timestamp UUID — elas já estão na ordem correta de aplicação.
> O CLI `supabase db push` aplica na ordem cronológica correta automaticamente.

### 2.4 ⚠️ OBRIGATÓRIO pós-migrations: configurar GUC para pg_net

O trigger `trigger_push_on_notification` (migration `20260317204734_fca31fcd.sql`)
usa `app.settings.supabase_url` e `app.settings.supabase_anon_key` como GUC.
**Se não configurados, o trigger usa o fallback hardcoded do projeto ANTIGO.**

```sql
-- Executar NO NOVO PROJETO imediatamente após todas as migrations
-- Substitua pelos valores reais do novo projeto
ALTER DATABASE postgres
  SET app.settings.supabase_url = 'https://NOVO_PROJECT_ID.supabase.co';

ALTER DATABASE postgres
  SET app.settings.supabase_anon_key = 'NOVO_ANON_KEY_eyJ...';

-- Verificar que ficou correto
SELECT current_setting('app.settings.supabase_url');
SELECT current_setting('app.settings.supabase_anon_key') IS NOT NULL AS key_set;
-- Esperado: URL do novo projeto, true
```

> Este passo está documentado no próprio migration `20260317204656_0a31e564.sql` (comentário linha 47-50).

### 2.5 Validar schema após aplicação

```sql
-- No novo projeto — verificar tabelas criadas (seção renumerada para 2.5)
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- Deve retornar ~47 tabelas

-- Verificar RLS habilitado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
-- ATENÇÃO: qualquer tabela aqui SEM RLS deve ser investigada

-- Verificar policies criadas
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
-- Deve retornar dezenas de policies
```

---

## Fase 3 — Migração de Dados

**Duração estimada**: 2-3h
**Pré-requisito**: Schema aplicado e validado na Fase 2

### 3.1 Ordem de importação (respeitar FKs)

```bash
# Desabilitar temporariamente triggers durante importação
psql "$NEW_DB_URL" -c "SET session_replication_role = replica;"

# Wave 1 — Dados de referência sem FK externas
psql "$NEW_DB_URL" -c "\COPY subscription_plans FROM 'export/subscription_plans.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY property_types FROM 'export/property_types.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY property_type_codes FROM 'export/property_type_codes.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY city_codes FROM 'export/city_codes.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY zone_codes FROM 'export/zone_codes.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY lead_stages FROM 'export/lead_stages.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY lead_types FROM 'export/lead_types.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY transaction_categories FROM 'export/transaction_categories.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY app_runtime_config FROM 'export/app_runtime_config.csv' CSV HEADER;"

# Wave 2 — Organizations (tabela raiz do multi-tenant)
psql "$NEW_DB_URL" -c "\COPY organizations FROM 'export/organizations.csv' CSV HEADER;"

# Wave 3 — Usuários (profiles após migração de auth.users — ver Fase 4)
# profiles, user_roles, admin_allowlist — APÓS Fase 4

# Wave 4 — Dados imobiliários
psql "$NEW_DB_URL" -c "\COPY owners FROM 'export/owners.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY owner_aliases FROM 'export/owner_aliases.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY properties FROM 'export/properties.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY property_images FROM 'export/property_images.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY property_media FROM 'export/property_media.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY property_owners FROM 'export/property_owners.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY property_share_links FROM 'export/property_share_links.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY property_landing_content FROM 'export/property_landing_content.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY property_partnerships FROM 'export/property_partnerships.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY property_visibility FROM 'export/property_visibility.csv' CSV HEADER;"

# Wave 5 — CRM
psql "$NEW_DB_URL" -c "\COPY leads FROM 'export/leads.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY lead_interactions FROM 'export/lead_interactions.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY lead_documents FROM 'export/lead_documents.csv' CSV HEADER;"

# Wave 6 — Contratos e financeiro
psql "$NEW_DB_URL" -c "\COPY contracts FROM 'export/contracts.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY contract_documents FROM 'export/contract_documents.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY commissions FROM 'export/commissions.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY invoices FROM 'export/invoices.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY transactions FROM 'export/transactions.csv' CSV HEADER;"

# Wave 7 — Tasks, agenda, notificações
psql "$NEW_DB_URL" -c "\COPY tasks FROM 'export/tasks.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY appointments FROM 'export/appointments.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY notifications FROM 'export/notifications.csv' CSV HEADER;"

# Wave 8 — Integrações
psql "$NEW_DB_URL" -c "\COPY ad_accounts FROM 'export/ad_accounts.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY ad_entities FROM 'export/ad_entities.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY ad_leads FROM 'export/ad_leads.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY ad_insights_daily FROM 'export/ad_insights_daily.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY rd_station_settings FROM 'export/rd_station_settings.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY imobzi_settings FROM 'export/imobzi_settings.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY import_runs FROM 'export/import_runs.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY import_run_items FROM 'export/import_run_items.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY push_subscriptions FROM 'export/push_subscriptions.csv' CSV HEADER;"

# Wave 9 — Marketplace e extras
psql "$NEW_DB_URL" -c "\COPY marketplace_properties FROM 'export/marketplace_properties.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY consumer_favorites FROM 'export/consumer_favorites.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY support_tickets FROM 'export/support_tickets.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY support_messages FROM 'export/support_messages.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY subscriptions FROM 'export/subscriptions.csv' CSV HEADER;"

# Wave 10 — Logs (importar por último, pode ser omitido se volume for alto)
psql "$NEW_DB_URL" -c "\COPY audit_logs FROM 'export/audit_logs.csv' CSV HEADER;"
psql "$NEW_DB_URL" -c "\COPY activity_log FROM 'export/activity_log.csv' CSV HEADER;"

# Reabilitar triggers
psql "$NEW_DB_URL" -c "SET session_replication_role = DEFAULT;"
```

### 3.2 Validação de integridade pós-importação

```sql
-- Comparar contagens com as anotadas na Fase 1.4
SELECT tablename, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verificar FK violations (não deve retornar nada)
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c2
    WHERE c2.oid = pg_constraint.oid
  );
```

---

## Fase 4 — Migração de Usuários (auth.users)

**Duração estimada**: 1-2h
**CRÍTICO**: Esta é a fase mais complexa. Os UUIDs MUDARÃO.

### 4.1 Criar usuários no novo projeto via Admin API

```typescript
// Script: migrate_users.ts
// Executar com: deno run --allow-net --allow-read --allow-write migrate_users.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const NEW_SUPABASE_URL = Deno.env.get("NEW_SUPABASE_URL")!;
const NEW_SERVICE_ROLE_KEY = Deno.env.get("NEW_SERVICE_ROLE_KEY")!;

const supabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY);

// Ler CSV exportado na Fase 1.2
const csvText = await Deno.readTextFile("auth_users_export.csv");
const lines = csvText.split("\n");
const headers = lines[0].split(",");

const idMapping: Record<string, string> = {}; // old_id → new_id

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;

  const values = lines[i].split(",");
  const user = {
    old_id: values[0],
    email: values[1],
    email_confirmed_at: values[2],
    raw_user_meta_data: values[4] ? JSON.parse(values[4]) : {},
    raw_app_meta_data: values[5] ? JSON.parse(values[5]) : {},
  };

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: "HabitaeMigration2026!Temp",
    email_confirm: true,
    user_metadata: user.raw_user_meta_data,
    app_metadata: user.raw_app_meta_data,
  });

  if (error) {
    console.error(`ERRO ao criar ${user.email}:`, error.message);
    // Se usuário já existe (email duplicate), buscar ID existente
    if (error.message.includes("already registered")) {
      const { data: existing } = await supabase.auth.admin.listUsers();
      const existingUser = existing?.users?.find(u => u.email === user.email);
      if (existingUser) {
        idMapping[user.old_id] = existingUser.id;
        console.log(`  → Mapeado para existente: ${existingUser.id}`);
      }
    }
    continue;
  }

  idMapping[user.old_id] = data.user.id;
  console.log(`✓ ${user.email}: ${user.old_id} → ${data.user.id}`);
}

// Salvar mapeamento
await Deno.writeTextFile("user_id_mapping.json", JSON.stringify(idMapping, null, 2));
console.log(`\nMapeamento salvo: ${Object.keys(idMapping).length} usuários`);
```

### 4.2 Aplicar mapeamento de UUIDs (CRÍTICO)

```sql
-- Script SQL para atualizar todas as FKs de user_id
-- Gerar dinamicamente a partir do user_id_mapping.json e executar

-- Criar tabela de mapeamento temporária
CREATE TEMP TABLE user_id_map (old_id UUID, new_id UUID);
-- Inserir dados do mapping (via script ou COPY)
-- Exemplo: INSERT INTO user_id_map VALUES ('old-uuid', 'new-uuid');

-- Atualizar profiles
UPDATE profiles p
SET user_id = m.new_id
FROM user_id_map m
WHERE p.user_id = m.old_id;

-- Atualizar user_roles
UPDATE user_roles ur
SET user_id = m.new_id
FROM user_id_map m
WHERE ur.user_id = m.old_id;

-- Atualizar leads
UPDATE leads l
SET broker_id = m.new_id
FROM user_id_map m
WHERE l.broker_id = m.old_id;

UPDATE leads l
SET created_by = m.new_id
FROM user_id_map m
WHERE l.created_by = m.old_id;

-- Atualizar properties
UPDATE properties p
SET created_by = m.new_id
FROM user_id_map m
WHERE p.created_by = m.old_id;

-- Atualizar contracts
UPDATE contracts c
SET broker_id = m.new_id
FROM user_id_map m
WHERE c.broker_id = m.old_id;

UPDATE contracts c
SET created_by = m.new_id
FROM user_id_map m
WHERE c.created_by = m.old_id;

-- Atualizar appointments
UPDATE appointments a
SET assigned_to = m.new_id
FROM user_id_map m
WHERE a.assigned_to = m.old_id;

UPDATE appointments a
SET created_by = m.new_id
FROM user_id_map m
WHERE a.created_by = m.old_id;

-- Atualizar tasks
UPDATE tasks t
SET assigned_to = m.new_id
FROM user_id_map m
WHERE t.assigned_to = m.old_id;

UPDATE tasks t
SET created_by = m.new_id
FROM user_id_map m
WHERE t.created_by = m.old_id;

-- Atualizar notifications
UPDATE notifications n
SET user_id = m.new_id
FROM user_id_map m
WHERE n.user_id = m.old_id;

-- Atualizar audit_logs
UPDATE audit_logs al
SET user_id = m.new_id
FROM user_id_map m
WHERE al.user_id = m.old_id;

-- Atualizar lead_interactions
UPDATE lead_interactions li
SET created_by = m.new_id
FROM user_id_map m
WHERE li.created_by = m.old_id;

-- Atualizar push_subscriptions
UPDATE push_subscriptions ps
SET user_id = m.new_id
FROM user_id_map m
WHERE ps.user_id = m.old_id;

-- Verificar se ainda existem referências a UUIDs antigos
-- (esta query deve retornar 0 rows se tudo foi atualizado)
SELECT 'profiles' as tbl, count(*) FROM profiles
  WHERE user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT 'user_roles', count(*) FROM user_roles
  WHERE user_id NOT IN (SELECT id FROM auth.users)
UNION ALL
SELECT 'leads_broker', count(*) FROM leads
  WHERE broker_id IS NOT NULL AND broker_id NOT IN (SELECT id FROM auth.users);
```

### 4.3 Comunicar usuários sobre reset de senha

```
Opção A (recomendada):
- Enviar email para todos os usuários explicando a migração
- Pedir que acessem "Esqueci minha senha" no próximo login
- A senha temporária "HabitaeMigration2026!Temp" funcionará apenas como fallback

Opção B (transparente):
- Forçar reset de senha via Supabase Admin API para todos os usuários
- Disparar email de reset para todos de uma vez
```

---

## Fase 5 — Configuração de Auth e RLS

**Duração estimada**: 30 min

### 5.1 Configurar Auth Settings no novo projeto

```
Supabase Dashboard → Authentication → URL Configuration:

Site URL: https://SEU_DOMINIO_PRODUCAO.com.br
         (ou https://NOVO_PROJECT_ID.lovable.app se ainda usando Lovable)

Redirect URLs (adicionar todos):
  - https://SEU_DOMINIO_PRODUCAO.com.br/**
  - https://SEU_DOMINIO_PRODUCAO.com.br/auth/callback
  - http://localhost:8080/**  (apenas para desenvolvimento)
```

### 5.2 Ativar proteções de segurança

```
Authentication → Settings:
  ✅ Enable email confirmations
  ✅ Leaked password protection (HaveIBeenPwned)
  ✅ Secure email change
  ✅ Secure phone change

  Session expiry: 604800 (7 dias, manter consistente com projeto antigo)
  JWT expiry: 3600 (1 hora)
```

### 5.3 Validar RLS após migração de usuários

```sql
-- Teste 1: Verificar que usuário SÓ vê dados da própria organização
-- (executar com usuário de teste que tem organization_id X)

-- Simular auth.uid() = 'new_user_uuid' em sessão do usuário
-- Verificar que SELECT em properties retorna apenas da org do usuário

-- Teste 2: Tentar acessar dados de outra org (deve retornar 0 rows)
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "USER_UUID_ORG_A", "role": "authenticated"}';
SELECT count(*) FROM properties
  WHERE organization_id = 'ORG_B_UUID';
-- Esperado: 0

-- Teste 3: Verificar que service_role bypassa RLS corretamente
SET LOCAL role TO service_role;
SELECT count(*) FROM properties;
-- Esperado: total de todas as organizações
```

---

## Fase 6 — Deploy de Edge Functions

**Duração estimada**: 30-45 min
**Ver**: `EDGE_FUNCTIONS_DEPLOYMENT_PLAN.md` para detalhamento completo

### 6.1 Processo de deploy

```bash
# Deploy de todas as funções de uma vez
supabase functions deploy --project-ref NOVO_PROJECT_ID

# Verificar deploy
supabase functions list --project-ref NOVO_PROJECT_ID
```

### 6.2 Verificar config.toml após deploy

As 35 funções com `verify_jwt = false` devem estar configuradas:
```bash
# Verificar que o config foi aplicado
supabase functions list --project-ref NOVO_PROJECT_ID | grep -E "verify_jwt"
```

---

## Fase 7 — Configuração de Secrets

**Duração estimada**: 30 min
**CRÍTICO**: Sem secrets, todas as integrações falham silenciosamente ou com erro 500.

### 7.1 Configurar todos os secrets no novo projeto

```bash
# Método 1: Via CLI (recomendado para automação)
supabase secrets set --project-ref NOVO_PROJECT_ID \
  SUPABASE_URL=https://NOVO_PROJECT_ID.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  SUPABASE_ANON_KEY=eyJ... \
  ASAAS_API_KEY=valor \
  ASAAS_SANDBOX=false \
  ASAAS_WEBHOOK_TOKEN=valor \
  META_APP_ID=valor \
  META_APP_SECRET=valor \
  RD_STATION_CLIENT_ID=valor \
  RD_STATION_CLIENT_SECRET=valor \
  ONESIGNAL_APP_ID=valor \
  ONESIGNAL_REST_API_KEY=valor \
  CLOUDINARY_CLOUD_NAME=valor \
  CLOUDINARY_API_KEY=valor \
  CLOUDINARY_API_SECRET=valor \
  CLOUDINARY2_CLOUD_NAME=valor \
  CLOUDINARY2_API_KEY=valor \
  CLOUDINARY2_API_SECRET=valor \
  R2_ACCESS_KEY_ID=valor \
  R2_SECRET_ACCESS_KEY=valor \
  R2_ENDPOINT=valor \
  R2_BUCKET_NAME=valor \
  R2_PUBLIC_URL=valor \
  CLOUDFLARE_ZONE_ID=valor \
  CLOUDFLARE_API_TOKEN=valor \
  GROQ_API_KEY_1=valor \
  GROQ_API_KEY_2=valor \
  GOOGLE_AI_KEY_1=valor \
  GOOGLE_AI_KEY_2=valor \
  OPENAI_IMAGE_API_KEY=valor \
  STABILITY_API_KEY=valor \
  IMAGE_STABILITY_KEY=valor \
  RESEND_API_KEY=valor \
  AI_GATEWAY_URL=https://openrouter.ai/api/v1 \
  AI_GATEWAY_API_KEY=sk-or-valor \
  GENERATE_ART_WEBHOOK=valor \
  GENERATE_VIDEO_WEBHOOK=valor \
  UAZAPI_BASE_URL=valor \
  UAZAPI_ADMIN_TOKEN=valor \
  STRIPE_TEST_SECRET_KEY=valor \
  ENVIRONMENT=production \
  APP_ALLOWED_ORIGINS=https://SEU_DOMINIO.com.br \
  APP_URL=https://SEU_DOMINIO.com.br
```

### 7.2 Checklist de secrets obrigatórios

| Secret | Obrigatório | Fonte | Status |
|--------|------------|-------|--------|
| SUPABASE_URL | ✅ | Novo projeto | `[ ]` |
| SUPABASE_SERVICE_ROLE_KEY | ✅ | Novo projeto | `[ ]` |
| SUPABASE_ANON_KEY | ✅ | Novo projeto | `[ ]` |
| ASAAS_API_KEY | ✅ | Painel Asaas | `[ ]` |
| ASAAS_WEBHOOK_TOKEN | ✅ | Painel Asaas | `[ ]` |
| META_APP_ID | ✅ | Facebook Developers | `[ ]` |
| META_APP_SECRET | ✅ | Facebook Developers | `[ ]` |
| RD_STATION_CLIENT_ID | ✅ | RD Station Marketplace | `[ ]` |
| RD_STATION_CLIENT_SECRET | ✅ | RD Station Marketplace | `[ ]` |
| ONESIGNAL_APP_ID | ✅ | Painel OneSignal | `[ ]` |
| ONESIGNAL_REST_API_KEY | ✅ | Painel OneSignal | `[ ]` |
| CLOUDINARY_CLOUD_NAME | ✅ | Painel Cloudinary | `[ ]` |
| CLOUDINARY_API_KEY | ✅ | Painel Cloudinary | `[ ]` |
| CLOUDINARY_API_SECRET | ✅ | Painel Cloudinary | `[ ]` |
| R2_ACCESS_KEY_ID | ✅ | Cloudflare Dashboard | `[ ]` |
| R2_SECRET_ACCESS_KEY | ✅ | Cloudflare Dashboard | `[ ]` |
| R2_ENDPOINT | ✅ | Cloudflare Dashboard | `[ ]` |
| R2_BUCKET_NAME | ✅ | Cloudflare Dashboard | `[ ]` |
| R2_PUBLIC_URL | ✅ | Cloudflare Dashboard | `[ ]` |
| RESEND_API_KEY | ✅ | Painel Resend | `[ ]` |
| GROQ_API_KEY_1 | ✅ | Painel Groq | `[ ]` |
| GOOGLE_AI_KEY_1 | ✅ | Google AI Studio | `[ ]` |
| OPENAI_IMAGE_API_KEY | ⚡ | OpenAI Dashboard | `[ ]` |
| STABILITY_API_KEY | ⚡ | Stability AI | `[ ]` |
| AI_GATEWAY_API_KEY | ⚡ (substitui LOVABLE) | OpenRouter.ai | `[ ]` |
| AI_GATEWAY_URL | ⚡ (substitui LOVABLE) | OpenRouter.ai | `[ ]` |
| GENERATE_ART_WEBHOOK | ⚡ | Config interna | `[ ]` |
| UAZAPI_BASE_URL | ⚡ | WhatsApp Provider | `[ ]` |
| APP_ALLOWED_ORIGINS | ✅ | Config interna | `[ ]` |
| ENVIRONMENT | ✅ | "production" | `[ ]` |

---

## Fase 8 — Cutover

**Ver**: `CUTOVER_STRATEGY.md` para detalhamento completo.

### Resumo do cutover:

```
1. Ativar modo manutenção no projeto antigo
2. Aguardar 5 min para requests em voo terminarem
3. Exportar delta (últimos dados desde export inicial)
4. Importar delta no novo projeto
5. Atualizar VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY + VITE_SUPABASE_PROJECT_ID no Lovable
6. Fazer novo build e deploy do frontend
7. Atualizar webhook URL no painel Asaas
8. Atualizar EDGE_BASE_URL no wa-worker (Easypanel)
9. Smoke tests (5-10 min)
10. Desativar modo manutenção
```

---

## Fase 9 — Validação Final

**Ver**: `FINAL_VALIDATION_CHECKLIST.md` para checklist completo.

---

## 14. Ordem Sequencial de Execução

```
PRÉ-REQUISITOS (resolver ANTES de agendar janela):
  []   → Decisão sobre LOVABLE_API_KEY: code fix ou degradação aceita (B2)
  []   → Auditar 6 funções AI sem fallback confirmado (B7)
  []   → Confirmar domínio portadocorretor.com.br e configurações DNS

DIAS ANTES DA JANELA:
  D-7  → Fase 0.1: Criar novo projeto Supabase (região sa-east-1)
  D-7  → Fase 0.2: Atualizar config.toml (project_id linha 1)
  D-7  → Fase 0.3: Supabase CLI link ao novo projeto
  D-7  → Fase 0.4: Decisão LOVABLE_API_KEY documentada
  D-7  → Fase 0.5: Habilitar pg_cron e pg_net no Dashboard do novo projeto
  D-2  → Fase 0.6: Atualizar redirect_uris (Meta + RD Station) ← obrigatório 24h antes
  D-1  → Fase 1.0: Exportar DB via /manutencao (schema + auth + tabelas)
  D-1  → Fase 2: Aplicar migrations em staging — verificar sem erros
  D-1  → Fase 2.4: ALTER DATABASE SET app.settings.supabase_url (staging)
  D-1  → Verificar trigger push aponta para URL correta no staging
  D-1  → Fase 3: Importar dados em staging — smoke test de contagens
  D-1  → Fase 7: Configurar todos os 30+ secrets
  D-1  → Fase 6: Deploy de edge functions no novo projeto

JANELA DE MANUTENÇÃO (D-0, ex: Dom 02:00):
  02:00 → Comunicar início da manutenção aos usuários
  02:05 → Ativar toggle-maintenance-mode no projeto antigo
  02:10 → Exportar delta de dados (Fase 1, segunda execução via /manutencao)
  02:30 → Importar delta no novo projeto
  03:00 → Fase 4: Criar usuários e mapear UUIDs
  04:00 → Fase 4.2: Atualizar FKs de user_id (15+ colunas)
  04:20 → Fase 2.4: ALTER DATABASE SET GUC para pg_net ← crítico
  04:25 → Verificar: SELECT current_setting('app.settings.supabase_url')
  04:30 → Fase 5: Validar auth + RLS
  05:00 → Fase 8: Cutover (atualizar env vars + rebuild)
  05:30 → Fase 9: Validação final (FINAL_VALIDATION_CHECKLIST.md)
  06:00 → Desativar modo manutenção ← go-live
  06:00-08:00 → Monitoramento intensivo

PÓS GO-LIVE:
  H+1  → Verificar trigger push disparou para novo projeto (criar notificação de teste)
  H+2  → Decisão de rollback (se necessário)
  H+24 → Confirmar que métricas estão normais
  H+72 → Desativar projeto Lovable antigo (após confirmar estabilidade)
  D+7  → Remover URIs antigas do Meta e RD Station (se rollback descartado)
```

---

*Documento versão 1.1 — Revisado em: 2026-03-18*
*Incorpora: confirmações técnicas do Lovable (pg_net, pg_cron, LOVABLE_API_KEY, ordem de import, /manutencao)*
*Próximo: [CUTOVER_STRATEGY.md](./CUTOVER_STRATEGY.md)*

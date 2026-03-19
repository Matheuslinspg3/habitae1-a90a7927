# EXPORT_PLAN.md — Plano de Exportação Habitae ERP
> Gerado em: 2026-03-19

---

## 1. FERRAMENTA DE EXPORTAÇÃO

A exportação é feita via `/manutencao` (page `src/pages/Maintenance.tsx`) que orquestra chamadas à Edge Function `export-database`.

### 1.1 Modos Disponíveis

| Modo | Endpoint | Retorno | Status |
|------|----------|---------|--------|
| `schema` | `POST {mode: "schema"}` | DDL completo (enums, tabelas, FKs, functions, triggers, policies, indexes, RLS, column_types) | ✅ Funcional |
| `auth` | `POST {mode: "auth"}` | CSV com auth.users (id, email, phone, metadata, timestamps) | ✅ Funcional |
| `table` | `POST {mode: "table", table: "nome"}` | CSV com todos os dados da tabela (paginado em blocos de 1000) | ✅ Funcional |

### 1.2 Formato de Saída

O frontend compila tudo em um arquivo `.sql` unificado com a seguinte estrutura:

```
1. Extensões (CREATE EXTENSION)
2. Enums (DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object)
3. Tabelas (CREATE TABLE IF NOT EXISTS — sem FKs)
4. Auth Users (INSERT com dados exportados — SEM senhas)
5. Dados de cada tabela (INSERT com type casts explícitos)
6. Foreign Keys (ALTER TABLE ADD CONSTRAINT)
7. RLS (ALTER TABLE ENABLE ROW LEVEL SECURITY)
8. Functions (CREATE OR REPLACE FUNCTION)
9. Triggers (CREATE TRIGGER)
10. Policies (CREATE POLICY)
11. Indexes (CREATE INDEX)
```

### 1.3 Limitações da Exportação

| Limitação | Impacto | Workaround |
|-----------|---------|------------|
| **Sem hashes de senha** | Usuários não podem fazer login após importação | Reset de senha obrigatório OU usar `pg_dump` direto |
| **Sem Storage buckets** | Arquivos no Supabase Storage não são exportados | Migrar manualmente ou via script |
| **Sem pg_cron jobs** | Jobs agendados não são incluídos no DDL | Recriar manualmente (ver INVENTORY.md §1.5) |
| **Sem GUC settings** | `app.settings.*` não são exportados | Configurar via `ALTER DATABASE` no novo projeto |
| **URLs hardcoded em triggers** | `trigger_push_on_notification` tem fallback hardcoded | Configurar GUC ou atualizar função |
| **Timeout em tabelas grandes** | Tabelas >100k rows podem exceder CPU time | Usar paginação (já implementada com blocos de 1000) |
| **Sem realtime config** | `ALTER PUBLICATION supabase_realtime ADD TABLE` não exportado | Reconfigurar manualmente |

---

## 2. ORDEM DE EXPORTAÇÃO (RECOMENDADA)

### Fase 1: Preparação (pré-cutover)
1. ✅ Verificar que `/manutencao` está acessível e funcional
2. ✅ Criar projeto Supabase destino (região `sa-east-1`)
3. ✅ Ativar extensões no destino: `pg_cron`, `pg_net`, `pg_trgm`, `pgcrypto`, `uuid-ossp`
4. ✅ Preparar todos os secrets (39 portáveis)

### Fase 2: Exportação (durante janela de manutenção)
1. Ativar modo manutenção (código `MIGRACAO`)
2. Aguardar force logout propagar (~30s)
3. Exportar Schema (`mode=schema`)
4. Exportar Auth Users (`mode=auth`)
5. Exportar dados tabela a tabela (`mode=table&table=...` — 89 tabelas)
6. Download do arquivo `.sql` gerado

### Fase 3: Importação no Destino
1. Executar extensões
2. Executar enums
3. Executar CREATE TABLE (sem FKs)
4. Importar auth.users (via SQL ou `auth.admin.createUser()`)
5. Importar dados de cada tabela
6. Executar ALTER TABLE ADD CONSTRAINT (FKs)
7. Executar ENABLE ROW LEVEL SECURITY
8. Executar CREATE OR REPLACE FUNCTION
9. Executar CREATE TRIGGER
10. Executar CREATE POLICY
11. Executar CREATE INDEX

### Fase 4: Pós-importação
1. Configurar GUC settings:
   ```sql
   ALTER DATABASE postgres SET app.settings.supabase_url = 'https://NOVO_PROJETO.supabase.co';
   ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'NOVA_ANON_KEY';
   ```
2. Recriar pg_cron jobs (2 jobs — ver INVENTORY.md §1.5)
3. Configurar realtime nas tabelas necessárias:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE public.app_runtime_config;
   ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
   ```
4. Configurar todos os 39 secrets via Supabase Dashboard ou CLI
5. Deploy das Edge Functions via `supabase functions deploy`
6. Atualizar OAuth redirect URIs (Meta, RD Station) para novo domínio
7. Atualizar webhook URLs externos (Asaas, RD Station)
8. Reset de senhas dos usuários (enviar email de reset)

---

## 3. TABELAS POR TAMANHO (TOP 10)

| Tabela | Tamanho | Prioridade |
|--------|---------|-----------|
| properties | 16.4 MB | Alta |
| rd_station_webhook_logs | 12.7 MB | Baixa (logs) |
| property_images | 11.7 MB | Alta |
| activity_log | 3.0 MB | Média |
| marketplace_properties | 2.4 MB | Alta |
| notifications | 1.1 MB | Média |
| leads | 1.0 MB | Alta |
| property_owners | 786 KB | Média |
| import_run_items | 614 KB | Baixa |
| audit_events | 541 KB | Baixa (logs) |

**Total estimado do banco: ~55 MB** — Exportação viável em uma única sessão.

---

## 4. TABELAS SENSÍVEIS

| Tabela | Dados Sensíveis | Cuidado |
|--------|----------------|---------|
| `ad_leads` | email, phone, nome | PII |
| `leads` | email, phone, notas | PII |
| `profiles` | full_name, phone | PII |
| `imobzi_api_keys` | api_key | Credencial |
| `rd_station_settings` | tokens OAuth | Credencial |
| `ai_provider_config` | API keys de IA | Credencial |
| `billing_payments` | dados de pagamento | Financeiro |

---

## 5. CHECKLIST DE VALIDAÇÃO PÓS-IMPORTAÇÃO

- [ ] Contagem de registros por tabela bate com origem
- [ ] auth.users importados com IDs preservados
- [ ] Login funcional (após reset de senha)
- [ ] RBAC funcional (user_roles + funções SQL)
- [ ] Modo manutenção ativa/desativa corretamente
- [ ] Push notifications disparam (pg_net + send-push)
- [ ] pg_cron jobs executando
- [ ] Edge Functions respondendo
- [ ] OAuth Meta e RD Station reconectados
- [ ] Billing (Asaas) webhooks recebendo

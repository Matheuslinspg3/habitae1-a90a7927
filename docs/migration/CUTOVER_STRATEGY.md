# Estratégia de Cutover — Habitae
## Lovable Cloud → Supabase Próprio

**Versão**: 1.0
**Data de elaboração**: 2026-03-18
**Duração estimada do cutover**: 60-90 min dentro da janela de 4-6h

---

## Índice

1. [Definição e Critérios de Go/No-Go](#1-definição-e-critérios-de-gono-go)
2. [Pré-condições para Iniciar o Cutover](#2-pré-condições-para-iniciar-o-cutover)
3. [Passo a Passo do Cutover](#3-passo-a-passo-do-cutover)
4. [Atualização de Serviços Externos](#4-atualização-de-serviços-externos)
5. [Smoke Tests Pós-Cutover](#5-smoke-tests-pós-cutover)
6. [Ativação Final (Go-Live)](#6-ativação-final-go-live)
7. [Monitoramento Pós-Go-Live](#7-monitoramento-pós-go-live)

---

## 1. Definição e Critérios de Go/No-Go

### O que é o cutover

Cutover é o momento exato em que o sistema deixa de ser servido pelo Lovable Cloud e passa a ser servido pelo novo projeto Supabase. Ele consiste em:

1. Parar escrita no sistema antigo (modo manutenção)
2. Sincronizar dados finais (delta)
3. Atualizar o frontend para apontar ao novo backend
4. Atualizar webhooks externos
5. Validar funcionamento
6. Reabrir para usuários

### Critérios Go (todos devem ser verdadeiros para prosseguir)

| Critério | Como verificar | Status |
|----------|---------------|--------|
| Migrations aplicadas sem erro | `supabase db push` retornou 0 erros | `[ ]` |
| Schema idêntico ao origem | Comparação de tabelas e columns | `[ ]` |
| Dados importados (contagens batem) | Query de contagem por tabela | `[ ]` |
| Usuários criados e FKs atualizadas | 0 FK violations no novo DB | `[ ]` |
| Todos os 30+ secrets configurados | Checklist da Fase 7 completo | `[ ]` |
| Edge functions deployed e respondendo | `supabase functions list` ok | `[ ]` |
| Auth + RLS validados | Teste de login + isolamento de org | `[ ]` |
| Meta redirect_uri atualizado | Testado em staging | `[ ]` |
| RD Station redirect_uri atualizado | Testado em staging | `[ ]` |
| Build do frontend compila sem erro | `bun run build` = exit 0 | `[ ]` |

### Critérios No-Go (qualquer um impede o cutover)

- FK violations após importação de dados
- Falha no login de usuário de teste
- RLS retornando dados de outra organização
- Edge function crítica (billing, auth) retornando 500
- Build do frontend falhando

---

## 2. Pré-condições para Iniciar o Cutover

### 2.1 Checklist final D-0 (antes de abrir a janela)

```bash
# 1. Confirmar que novo projeto está pronto
supabase projects list
# Verificar que NOVO_PROJECT_ID aparece na lista

# 2. Confirmar deploy de functions
supabase functions list --project-ref NOVO_PROJECT_ID
# Deve listar todas as 68 funções

# 3. Teste de conectividade básica no novo projeto
curl -s "https://NOVO_PROJECT_ID.supabase.co/rest/v1/" \
  -H "apikey: $NEW_ANON_KEY" | head -c 100
# Deve retornar resposta JSON (não erro de conexão)

# 4. Confirmar que modo manutenção funciona no projeto ANTIGO
curl -X POST \
  "https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/toggle-maintenance-mode" \
  -H "Authorization: Bearer $OLD_SERVICE_ROLE_KEY" \
  -d '{"action": "status"}'
# Verificar resposta (não ativar ainda, apenas testar)
```

---

## 3. Passo a Passo do Cutover

### STEP 1 — Ativar modo manutenção no projeto ANTIGO

**Hora**: 02:00 (início da janela)
**Responsável**: Engenheiro Lead
**Duração**: 2 min

```bash
# Ativar modo manutenção
curl -X POST \
  "https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/toggle-maintenance-mode" \
  -H "Authorization: Bearer $OLD_SERVICE_ROLE_KEY" \
  -d '{"action": "enable", "message": "Sistema em manutenção programada. Retorno previsto: 06:00h. Agradecemos a compreensão."}'

# Confirmar ativação
curl -X GET \
  "https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/toggle-maintenance-mode" \
  -H "Authorization: Bearer $OLD_SERVICE_ROLE_KEY"
```

**Verificação**: Acessar o app no browser → deve mostrar tela de manutenção.

> ⚠️ A partir deste momento, NENHUMA escrita nova ocorre no sistema antigo.

### STEP 2 — Aguardar requests em voo

**Hora**: 02:02
**Duração**: 5 min

```bash
# Monitorar logs do projeto antigo por 5 minutos
# Aguardar que não haja mais writes nos logs (Dashboard → Logs → Edge Functions)
# Verificar logs de: billing, crm, leads, properties
```

### STEP 3 — Exportar delta (dados desde a última exportação)

**Hora**: 02:07
**Duração**: 15-20 min

```bash
LOVABLE_DB_URL="postgresql://postgres.aiflfkkjitvsyszwdfga:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"

# Exportar apenas dados modificados após o timestamp da exportação inicial
# Substituir LAST_EXPORT_TIMESTAMP pelo timestamp da Fase 1

LAST_EXPORT="2026-03-15 00:00:00"  # <- ajustar para timestamp real

# Exportar tabelas com updated_at ou created_at recentes
for table in properties leads lead_interactions contracts commissions transactions notifications tasks appointments; do
  psql "$LOVABLE_DB_URL" -c \
    "COPY (SELECT * FROM $table WHERE updated_at > '$LAST_EXPORT' OR created_at > '$LAST_EXPORT') TO STDOUT WITH CSV HEADER" \
    > "delta/${table}_delta.csv"
  echo "Delta $table: $(wc -l < delta/${table}_delta.csv) rows"
done

# Tabelas sem timestamp — exportar completo (geralmente pequenas)
for table in push_subscriptions rd_station_settings imobzi_settings; do
  psql "$LOVABLE_DB_URL" -c \
    "COPY (SELECT * FROM $table) TO STDOUT WITH CSV HEADER" \
    > "delta/${table}_full.csv"
done
```

### STEP 4 — Importar delta no novo projeto

**Hora**: 02:25
**Duração**: 20-30 min

```bash
NEW_DB_URL="postgresql://postgres.NOVO_PROJECT_ID:NOVA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"

# Desabilitar triggers durante importação delta
psql "$NEW_DB_URL" -c "SET session_replication_role = replica;"

# UPSERT dos dados delta (não INSERT simples, para evitar conflitos com dados já existentes)
# Usar COPY com ON CONFLICT DO UPDATE onde possível

for table in properties leads lead_interactions contracts commissions transactions notifications tasks appointments; do
  if [ -s "delta/${table}_delta.csv" ]; then
    echo "Importando delta: $table"
    # Criar tabela temporária, importar, fazer upsert
    psql "$NEW_DB_URL" <<SQL
      CREATE TEMP TABLE ${table}_delta (LIKE $table INCLUDING ALL);
      \COPY ${table}_delta FROM 'delta/${table}_delta.csv' CSV HEADER;
      INSERT INTO $table
        SELECT * FROM ${table}_delta
        ON CONFLICT (id) DO UPDATE SET
          -- Atualizar apenas se o registro do delta é mais recente
          updated_at = EXCLUDED.updated_at;
      DROP TABLE ${table}_delta;
SQL
  fi
done

# Re-habilitar triggers
psql "$NEW_DB_URL" -c "SET session_replication_role = DEFAULT;"
```

### STEP 5 — Validação final de consistência

**Hora**: 02:55
**Duração**: 10 min

```bash
# Comparar contagens entre origem e destino
echo "=== COMPARAÇÃO DE CONTAGENS ==="
for table in organizations profiles properties leads contracts commissions transactions; do
  OLD_COUNT=$(psql "$LOVABLE_DB_URL" -t -c "SELECT count(*) FROM $table;")
  NEW_COUNT=$(psql "$NEW_DB_URL" -t -c "SELECT count(*) FROM $table;")
  echo "$table: OLD=$OLD_COUNT | NEW=$NEW_COUNT"
  if [ "$OLD_COUNT" != "$NEW_COUNT" ]; then
    echo "  ⚠️  DIVERGÊNCIA em $table!"
  fi
done
```

> ⚠️ Divergências pequenas (<1%) em tabelas de logs são aceitáveis.
> Divergências em tabelas críticas (organizations, properties, leads, contracts) = **NO-GO**.

### STEP 6 — Atualizar variáveis de ambiente do frontend

**Hora**: 03:05
**Duração**: 10 min
**Local**: Lovable Dashboard (se ainda usando Lovable para deploy do frontend)

```
Lovable Dashboard → Projeto → Settings → Environment Variables:

  VITE_SUPABASE_URL          = https://NOVO_PROJECT_ID.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY = eyJ... (novo anon key)
  VITE_SUPABASE_PROJECT_ID   = NOVO_PROJECT_ID
```

**Alternativa (se usando CI/CD próprio)**:
```bash
# Atualizar .env de produção
echo "VITE_SUPABASE_URL=https://NOVO_PROJECT_ID.supabase.co" >> .env.production
echo "VITE_SUPABASE_PUBLISHABLE_KEY=eyJ..." >> .env.production
echo "VITE_SUPABASE_PROJECT_ID=NOVO_PROJECT_ID" >> .env.production
```

### STEP 7 — Build e deploy do frontend

**Hora**: 03:15
**Duração**: 5-10 min

```bash
# Build local para validar antes do deploy
bun run build
# Verificar: zero erros, zero warnings críticos

# Deploy via Lovable (automático após push) ou manualmente:
git add -A
git commit -m "cutover: atualizar endpoint para novo Supabase [MIGRATION-2026-03-18]"
git push origin main
```

**Verificação imediata**:
```bash
# Após deploy, verificar que a URL da API no bundle aponta ao novo projeto
curl https://SEU_DOMINIO.com.br/assets/index-*.js | grep -o "NOVO_PROJECT_ID"
# Deve retornar o novo project ID
```

---

## 4. Atualização de Serviços Externos

### 4.1 Asaas — Webhook URL

**Hora**: 03:25 (durante janela)
**Local**: Painel Asaas → Configurações → Webhooks

```
URL antiga: https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/billing-webhook
URL nova:   https://NOVO_PROJECT_ID.supabase.co/functions/v1/billing-webhook

Ação:
1. Acessar https://app.asaas.com → Configurações → Notificações/Webhooks
2. Editar webhook existente ou criar novo
3. URL: https://NOVO_PROJECT_ID.supabase.co/functions/v1/billing-webhook
4. Token: (mesmo ASAAS_WEBHOOK_TOKEN configurado nos secrets)
5. Salvar e enviar payload de teste
```

**Teste de webhook Asaas**:
```bash
# O Asaas tem função "Enviar Evento de Teste" no painel
# Verificar nos logs do novo projeto que o evento foi recebido:
supabase functions logs billing-webhook --project-ref NOVO_PROJECT_ID
```

### 4.2 WhatsApp (UAZAPI / wa-worker no Easypanel)

**Hora**: 03:30
**Local**: Painel Easypanel → wa-worker → Variáveis de Ambiente

```
Variável: EDGE_BASE_URL
Valor antigo: https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1
Valor novo:   https://NOVO_PROJECT_ID.supabase.co/functions/v1

Ação:
1. Acessar painel Easypanel
2. Selecionar serviço wa-worker
3. Environment → Editar EDGE_BASE_URL
4. Salvar e reiniciar serviço
```

### 4.3 Meta Ads — Verificação de OAuth

```
Os OAuth tokens do Meta estão na tabela ad_accounts (migrada com os dados).
Os tokens em si continuam válidos após a migração.
Porém, novos fluxos de OAuth (reautorização) precisam do novo redirect_uri.

Ação pós-cutover:
1. Verificar que meta-sync-leads e meta-sync-entities funcionam com tokens migrados
2. Se tokens expiraram: usuários precisarão fazer novo OAuth flow
   URL nova: https://SEU_DOMINIO.com.br/ads?oauth=meta
```

### 4.4 RD Station — Verificação de OAuth

```
Tokens OAuth do RD Station estão na tabela rd_station_settings (migrada).
Verificar se os tokens ainda são válidos (têm prazo de expiração).

Ação pós-cutover:
1. Chamar rd-station-stats no novo projeto para testar token
2. Se retornar 401: usuários precisarão refazer OAuth
   URL nova: https://SEU_DOMINIO.com.br/crm/rd-station?reauth=true
```

---

## 5. Smoke Tests Pós-Cutover

**Hora**: 03:35
**Duração**: 20-30 min
**Responsável**: QA / Engenheiro disponível

### 5.1 Teste de autenticação

```bash
# Teste 1: Login com usuário existente
curl -X POST \
  "https://NOVO_PROJECT_ID.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: $NEW_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "usuario_teste@habitae.com.br", "password": "HabitaeMigration2026!Temp"}'
# Esperado: access_token, refresh_token, user object

# Guardar access_token para testes seguintes
ACCESS_TOKEN="eyJ..."
```

### 5.2 Teste de leitura de dados

```bash
# Teste 2: Buscar propriedades (autenticado)
curl "https://NOVO_PROJECT_ID.supabase.co/rest/v1/properties?limit=5" \
  -H "apikey: $NEW_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
# Esperado: array de propriedades da organização do usuário

# Teste 3: Verificar RLS (dados de outra org não devem aparecer)
# Se retornar dados de outras organizações = FALHA CRÍTICA DE SEGURANÇA
```

### 5.3 Teste de edge functions críticas

```bash
# Função de billing (retornar 200 ou 400, nunca 500)
curl -X POST \
  "https://NOVO_PROJECT_ID.supabase.co/functions/v1/billing" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_customer"}' | jq .

# Função de upload (r2-presign)
curl -X POST \
  "https://NOVO_PROJECT_ID.supabase.co/functions/v1/r2-presign" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.jpg", "contentType": "image/jpeg"}' | jq .
# Esperado: {url: "https://...", fields: {...}}

# Função de notificações
curl -X GET \
  "https://NOVO_PROJECT_ID.supabase.co/functions/v1/onesignal-app-id" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
# Esperado: {app_id: "..."}
```

### 5.4 Teste de escrita

```bash
# Criar lead de teste
curl -X POST \
  "https://NOVO_PROJECT_ID.supabase.co/rest/v1/leads" \
  -H "apikey: $NEW_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "name": "TESTE MIGRAÇÃO - DELETAR",
    "email": "teste_migracao@teste.com",
    "phone": "11999999999"
  }' | jq .
# Esperado: objeto lead com id UUID

# Verificar que foi salvo
# Deletar o lead de teste após validação
```

### 5.5 Critérios de Go-Live (todos devem passar)

- [ ] Login retorna access_token válido
- [ ] Dados de propriedades carregam com RLS correto
- [ ] r2-presign retorna URL presignada válida
- [ ] billing function retorna resposta (não 500)
- [ ] INSERT de lead de teste funciona
- [ ] Webhook Asaas recebido nos logs
- [ ] Frontend carrega sem erros no console (F12)

---

## 6. Ativação Final (Go-Live)

**Hora**: 04:00-05:00 (dependendo do smoke test)

### 6.1 Desativar modo manutenção no projeto ANTIGO

```bash
# APENAS SE todos os smoke tests passaram
curl -X POST \
  "https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/toggle-maintenance-mode" \
  -H "Authorization: Bearer $OLD_SERVICE_ROLE_KEY" \
  -d '{"action": "disable"}'
```

> ⚠️ O projeto ANTIGO permanece ativo como fallback, mas sem modo manutenção.
> Usuários que ainda têm cache do app antigo podem acessar brevemente o projeto antigo.
> Isso é seguro — os dados antigos ficam como snapshot point-in-time.

### 6.2 Atualizar DNS (se domínio customizado)

```
Se o sistema usa domínio customizado (ex: app.habitae.com.br):

Opção A — se a URL do app não muda (subdomínio aponta ao Lovable/Vercel):
  Nenhuma ação necessária se o frontend foi redeployado na mesma plataforma.

Opção B — se mudando de plataforma de deploy:
  DNS → CNAME app.habitae.com.br → novo-hosting.com
  TTL: configurar para 300s (5 min) com 24h de antecedência
```

### 6.3 Comunicar usuários

```
Enviar notificação (via OneSignal no novo projeto) ou email (Resend):

Assunto: Sistema Habitae atualizado com sucesso

"O sistema Habitae foi atualizado com sucesso. Caso encontre qualquer
problema ao acessar, por favor faça logout e login novamente.
Se necessário, use 'Esqueci minha senha' para redefinir sua senha."
```

---

## 7. Monitoramento Pós-Go-Live

### 7.1 Primeiras 2 horas (monitoramento intensivo)

```bash
# Monitorar logs de edge functions em tempo real
supabase functions logs --project-ref NOVO_PROJECT_ID --tail

# Verificar métricas de erro no Dashboard:
# Novo Supabase Dashboard → Logs → API Logs
# Filtrar por: status >= 500

# Monitorar tabela de auth.users (novos logins devem aparecer)
psql "$NEW_DB_URL" -c "
  SELECT email, last_sign_in_at
  FROM auth.users
  WHERE last_sign_in_at > NOW() - INTERVAL '2 hours'
  ORDER BY last_sign_in_at DESC
  LIMIT 20;"
```

### 7.2 Primeiras 24 horas

| Métrica | O que verificar | Frequência |
|---------|----------------|-----------|
| Auth | Taxa de login bem-sucedido | A cada 30 min |
| API | Taxa de erro 5xx | A cada 30 min |
| Edge Functions | Funções retornando erro | A cada hora |
| Billing | Webhooks Asaas sendo recebidos | A cada hora |
| Storage | Uploads de imagem funcionando | A cada 2h |
| Push | Notificações sendo enviadas | A cada 2h |

### 7.3 Critérios de rollback pós-go-live

**Ver**: `ROLLBACK_PLAN.md`

Ativar rollback se:
- Taxa de erro 5xx > 5% por mais de 10 min
- Falha de login para >20% dos usuários
- Dados corrompidos identificados
- Serviço de billing completamente quebrado

Janela de rollback: **até 2h após o go-live**.
Após 2h: delta de dados é grande demais para reverter sem perda.

---

*Documento gerado em: 2026-03-18*
*Anterior: [MIGRATION_EXECUTION_PLAN.md](./MIGRATION_EXECUTION_PLAN.md)*
*Próximo: [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md)*

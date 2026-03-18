# Blockers Pré-Execução — Migração Habitae
## Lovable Cloud → Supabase Próprio

**Versão**: 1.0
**Data**: 2026-03-18
**Propósito**: Este documento lista todos os blockers que devem ser resolvidos **antes** de iniciar
a janela de manutenção de produção. Nenhum cutover deve ser iniciado com blockers técnicos abertos.

---

## Como usar este documento

- Cada blocker tem: descrição, arquivo/evidência técnica, ação necessária, responsável, prazo
- Blockers marcados 🔴 **bloqueiam o go-live** — não iniciar cutover com eles abertos
- Blockers marcados 🟡 **devem ser resolvidos antes** mas têm mitigação alternativa documentada
- Marcar `[x]` apenas quando a ação foi concluída e verificada

---

## GRUPO BT — Blockers Técnicos

### BT1 — pg_net trigger com URL hardcoded 🔴

**Descrição**: O migration `20260317204734_fca31fcd.sql` (mais recente cronologicamente)
reintroduz fallback hardcoded para o projeto antigo na função `trigger_push_on_notification`.
Se o GUC `app.settings.supabase_url` não estiver configurado, o trigger enviará push ao projeto
antigo silenciosamente.

**Evidência técnica**:
- `supabase/migrations/20260317204734_fca31fcd.sql`, linhas 23 e 30
- Linha 23: `'https://aiflfkkjitvsyszwdfga.supabase.co'` (hardcoded)
- Linha 30: anon key antiga hardcoded em plaintext

**Ação necessária**:
```sql
-- Executar IMEDIATAMENTE após supabase db push, antes do go-live
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://NOVO_PROJECT_ID.supabase.co';
ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'NOVO_ANON_KEY';

-- Verificar
SELECT current_setting('app.settings.supabase_url');
-- Deve retornar: https://NOVO_PROJECT_ID.supabase.co (NÃO aiflfkkjitvsyszwdfga)
```

**Responsável**: Engenharia (backend/DBA)
**Prazo**: Durante a Fase 2 do cutover (pós-`supabase db push`, pré-go-live)
- [ ] Executado
- [ ] Verificado (`SELECT current_setting(...)` confirmado)

---

### BT2 — User UUIDs mudam — script de mapeamento obrigatório 🔴

**Descrição**: UUIDs de usuários em `auth.users` são diferentes entre projetos Supabase.
Todas as tabelas com colunas FK para `auth.users` precisam ter os UUIDs atualizados após
a importação dos dados.

**Colunas afetadas** (mínimo 15 identificadas):
```
profiles.user_id
user_roles.user_id
properties.created_by, properties.broker_id
leads.broker_id, leads.assigned_to
contracts.created_by
commissions.user_id
transactions.created_by
tasks.assigned_to, tasks.created_by
notifications.user_id
push_subscriptions.user_id
ad_accounts.user_id
rd_station_settings.user_id
meta_tokens.user_id
```

**Ação necessária**:
1. Exportar mapeamento `{old_uuid: new_uuid}` durante importação de `auth.users`
2. Executar script de UPDATE em cada coluna FK antes de habilitar FKs e RLS
3. Verificar 0 FK violations após UPDATE

**Responsável**: Engenharia (backend)
**Prazo**: Fase 4 do plano de execução (antes de habilitar Foreign Keys)
- [ ] Script de mapeamento criado e testado em staging
- [ ] Script de UPDATE cobriu todas as 15+ colunas
- [ ] 0 FK violations verificadas

---

### BT3 — LOVABLE_API_KEY não portável — decisão de código obrigatória 🔴

**Descrição**: 7 funções Edge usam `LOVABLE_API_KEY` para chamar `ai.gateway.lovable.dev`.
Este endpoint não existe fora do Lovable Cloud. Apenas `validate-document` tem fallback
confirmado. As demais 6 funções precisam de decisão antes do cutover.

**Funções sem fallback auditado**:
```
generate-contract-template
summarize-lead
analyze-photo-quality
contract-ai-fill
extract-property-pdf
test-ai-connection
```

**Evidência**: `supabase/functions/validate-document/index.ts` — único com fallback confirmado.
Demais: buscar `ai.gateway.lovable.dev` no código de cada função.

**Decisão binária — uma das duas deve ser tomada**:

**Opção A (recomendada)**: Auditar e substituir `ai.gateway.lovable.dev` por provider direto
em cada função. Providers disponíveis: `GROQ_API_KEY_1/2`, `GOOGLE_AI_KEY_1/2`, `AI_GATEWAY_URL`.

**Opção B**: Aceitar degradação explicitamente.
```
Impacto aceito:
- Geração de contratos via IA: INATIVA
- Resumo automático de leads: INATIVO
- Análise de qualidade de foto: INATIVA
- Preenchimento automático de contratos: INATIVO
- Extração de dados de PDF: INATIVA
- validate-document: degradação silenciosa (retorna {skipped: true})
```

**Responsável**: Engenharia + Product (decisão de produto) + Negócio (impacto aceitável?)
**Prazo**: D-7 (pelo menos 1 semana antes do cutover para code fix, se Opção A)
- [ ] Decisão tomada: Opção A / Opção B
- [ ] Se Opção A: todas as 6 funções auditadas e código corrigido
- [ ] Se Opção A: testado em staging com providers diretos
- [ ] Se Opção B: stakeholders informados sobre features degradadas

---

### BT4 — pg_cron e pg_net: habilitar no Dashboard manualmente 🟡

**Descrição**: A migration `20260305044221_31cb21cf.sql` cria as extensões `pg_cron` e `pg_net`
via SQL, mas extensões em Supabase gerenciado precisam ser habilitadas no Dashboard primeiro.

**Evidência**: `supabase/migrations/20260305044221_31cb21cf.sql` — linha 1-2.

**Ação necessária**:
```
Supabase Dashboard → Settings → Extensions → Buscar "pg_cron" → Enable
Supabase Dashboard → Settings → Extensions → Buscar "pg_net" → Enable
Fazer isso ANTES de rodar supabase db push (ou a migration falhará)
```

**Responsável**: Engenharia (DevOps/infra)
**Prazo**: Fase 0 do plano de execução (setup do novo projeto)
- [ ] pg_cron habilitado no Dashboard do novo projeto
- [ ] pg_net habilitado no Dashboard do novo projeto

---

### BT5 — config.toml com project_id antigo 🔴

**Descrição**: `supabase/config.toml` linha 1 contém `project_id = "aiflfkkjitvsyszwdfga"`.
Se não for atualizado, qualquer comando `supabase` apontará para o projeto errado.

**Evidência**: `supabase/config.toml`, linha 1.

**Ação necessária**:
```toml
# Atualizar para o novo project ID antes de qualquer deploy
project_id = "NOVO_PROJECT_ID"
```

**Responsável**: Engenharia
**Prazo**: Antes do primeiro `supabase db push` no novo projeto
- [ ] `config.toml` atualizado com novo project_id
- [ ] Verificado: `supabase projects list` mostra o projeto correto

---

## GRUPO BO — Blockers Operacionais

### BO1 — Novo projeto Supabase não existe ainda 🔴

**Descrição**: O projeto Supabase de destino precisa ser criado e suas credenciais coletadas
antes de qualquer etapa de migração.

**Ação necessária**:
```
1. Criar novo projeto em app.supabase.com
   - Região: sa-east-1 (São Paulo) para menor latência
   - Plano: Pro (necessário para pg_cron, PITR, mais conexões)
2. Coletar e armazenar em local seguro:
   - Project ID (ex: abcdefghijklmnop)
   - URL (https://NOVO_PROJECT_ID.supabase.co)
   - Anon/Public key
   - Service Role key
   - DB password
   - Connection string (postgresql://postgres.NOVO_PROJECT_ID:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres)
```

**Responsável**: Engenharia/DevOps
**Prazo**: D-14 (2 semanas antes — para tempo de testes em staging)
- [ ] Novo projeto criado
- [ ] Credenciais coletadas e armazenadas com segurança
- [ ] Acesso confirmado (psql + supabase CLI funcionando)

---

### BO2 — 30+ secrets precisam ser configurados antes do deploy 🔴

**Descrição**: Todas as edge functions precisam dos secrets corretos antes de serem deployadas.
Secrets faltando causam falhas silenciosas difíceis de depurar.

**Lista completa** (ver MIGRATION_EXECUTION_PLAN.md Fase 7 para lista detalhada):
```
Críticos para funcionamento básico:
SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL

Billing:
ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN, ASAAS_SANDBOX_MODE

Storage:
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

Comunicação:
ONESIGNAL_APP_ID, ONESIGNAL_API_KEY, RESEND_API_KEY

Integrações:
META_APP_ID, META_APP_SECRET
RD_STATION_CLIENT_ID, RD_STATION_CLIENT_SECRET
GOOGLE_MAPS_API_KEY, VITE_GOOGLE_MAPS_EMBED_KEY

AI (se Opção A):
GROQ_API_KEY_1, GROQ_API_KEY_2
GOOGLE_AI_KEY_1, GOOGLE_AI_KEY_2
OPENAI_IMAGE_API_KEY
AI_GATEWAY_URL, AI_GATEWAY_API_KEY

WhatsApp:
UAZAPI_API_KEY, UAZAPI_INSTANCE_URL

Outros:
IMOBZI_API_KEY, STABILITY_API_KEY, IMAGE_STABILITY_KEY
ENCRYPTION_KEY, JWT_SECRET
LOVABLE_API_KEY → NÃO configurar (key inválida no novo ambiente)
```

**Responsável**: Engenharia
**Prazo**: D-3 (configurar e validar com antecedência)
- [ ] Todos os secrets listados configurados (`supabase secrets set`)
- [ ] Deploy de função de diagnóstico (`test-ai-connection`) confirma providers OK
- [ ] `LOVABLE_API_KEY` confirmada como NÃO configurada (seria inútil)

---

### BO3 — Staging: confirmar/criar ambiente de teste 🟡

**Descrição**: Toda a migração deve ser testada em staging com uma cópia dos dados de produção
antes da janela de manutenção de produção. Isso é obrigatório para validar o script de
mapeamento de UUIDs, a ordem de importação e os secrets.

**Ação necessária**:
```
1. Criar projeto Supabase staging (separado do produção)
2. Exportar dados de produção (subset ou completo)
3. Executar migração completa em staging
4. Validar checklist completo (FINAL_VALIDATION_CHECKLIST.md)
5. Documentar issues encontrados e resolver antes da produção
```

**Responsável**: Engenharia
**Prazo**: D-7 (1 semana antes do cutover de produção)
- [ ] Ambiente staging criado
- [ ] Migração completa executada em staging
- [ ] Checklist validado em staging (todos os 🔴 OK)
- [ ] Issues de staging resolvidos

---

## GRUPO BI — Blockers de Integração Externa

### BI1 — Meta OAuth redirect_uri não atualizado 🔴

**Descrição**: O Meta (Facebook) exige que redirect_uris sejam pré-configuradas. A nova URI
de callback precisa ser adicionada com pelo menos 24h de antecedência (tempo de propagação).

**URI a adicionar** (no Facebook App Developers → Valid OAuth Redirect URIs):
```
https://NOVO_PROJECT_ID.supabase.co/functions/v1/meta-oauth-callback
```

**MANTER** a URI antiga também (para rollback):
```
https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/meta-oauth-callback
```

**Responsável**: Engenharia/Marketing
**Prazo**: D-2 (pelo menos 48h antes do cutover)
- [ ] Nova URI adicionada no Facebook App Developers
- [ ] URI antiga mantida (não remover)
- [ ] Teste de OAuth com nova URI em staging

---

### BI2 — RD Station OAuth redirect_uri não atualizado 🔴

**Descrição**: Mesma situação do Meta. RD Station precisa da nova URI configurada com antecedência.

**URI a adicionar** (no painel RD Station):
```
https://NOVO_PROJECT_ID.supabase.co/functions/v1/rd-station-callback
```

**Responsável**: Engenharia/Marketing
**Prazo**: D-2 (pelo menos 48h antes do cutover)
- [ ] Nova URI adicionada no RD Station
- [ ] URI antiga mantida
- [ ] Teste de OAuth com nova URI em staging

---

### BI3 — Asaas webhook URL não preparado para atualização 🟡

**Descrição**: A URL do webhook Asaas precisará ser atualizada durante a janela de cutover.
Isso deve ser preparado com antecedência (credenciais de acesso ao painel, URL nova pronta).

**URL a configurar** (durante cutover, não antes):
```
https://NOVO_PROJECT_ID.supabase.co/functions/v1/billing-webhook
```

**Ação necessária** (pré-cutover):
```
- Confirmar acesso ao painel Asaas
- Anotar URL atual do webhook (para rollback)
- Ter a nova URL pronta para copiar durante cutover
```

**Responsável**: Engenharia/Financeiro
**Prazo**: D-1 (preparação) / Durante cutover (execução)
- [ ] Acesso ao painel Asaas confirmado
- [ ] URL atual do webhook anotada (para rollback)
- [ ] Plano de execução durante cutover documentado

---

### BI4 — Easypanel EDGE_BASE_URL não preparado 🟡

**Descrição**: O wa-worker no Easypanel precisa ter `EDGE_BASE_URL` atualizado durante o cutover.

**Valor a configurar** (durante cutover):
```
EDGE_BASE_URL = https://NOVO_PROJECT_ID.supabase.co/functions/v1
```

**Ação necessária** (pré-cutover):
```
- Confirmar acesso ao Easypanel (credenciais)
- Anotar EDGE_BASE_URL atual (para rollback)
```

**Responsável**: Engenharia/DevOps
**Prazo**: D-1 (preparação) / Durante cutover (execução)
- [ ] Acesso ao Easypanel confirmado
- [ ] Valor atual de EDGE_BASE_URL anotado (para rollback)

---

## GRUPO BS — Blockers de Segurança

### BS1 — 6 funções AI sem fallback auditado 🔴

**(Duplicado do BT3 — incluído aqui por relevância de segurança)**

Funções que falham abertamente (erro 500) são piores do que funções que degradam silenciosamente.
Antes do go-live, confirmar que nenhuma função retornará stack trace ou dados sensíveis em erros.

**Ação**: Auditar `try/catch` e fallback em cada uma das 6 funções. Verificar que nenhuma
expõe URL interna, stack trace, ou dados de outros usuários no body de resposta de erro.

- [ ] Auditoria de error handling nas 6 funções AI concluída

---

### BS2 — Domínio `portadocorretor.com.br` configurado no novo ambiente 🟡

**Descrição**: O domínio de produção `portadocorretor.com.br` precisa estar apontando para
o novo projeto após o cutover. Verificar configuração de DNS e custom domain no Supabase.

**Ação necessária**:
```
1. Configurar custom domain no Supabase Dashboard (se aplicável)
2. Verificar TTL do DNS (reduzir para 300s com antecedência para rollback rápido)
3. Confirmar que certificado SSL está ativo
```

**Responsável**: Engenharia/DevOps
**Prazo**: D-3
- [ ] DNS verificado e TTL reduzido (se aplicável)
- [ ] Custom domain configurado no novo Supabase (se aplicável)
- [ ] SSL ativo e válido

---

## GRUPO BU — Blockers de UX e Comunicação

### BU1 — Usuários precisam redefinir senha — comunicação preparada? 🟡

**Descrição**: Dependendo do método de migração de `auth.users`, usuários podem precisar
redefinir suas senhas. Se o bcrypt_hash for exportado corretamente via `/manutencao?mode=auth`,
a maioria não precisará. Mas ter o fluxo preparado é obrigatório.

**Ação necessária**:
```
1. Confirmar se bcrypt_hash foi exportado e importado corretamente (teste em staging)
2. Se necessário: preparar email template de "Redefina sua senha"
3. Preparar push notification de "Sistema atualizado — acesse normalmente"
4. Definir canal de suporte e responsável durante as primeiras 4h pós-go-live
```

**Responsável**: Marketing/CX + Engenharia
**Prazo**: D-3
- [ ] Teste de login com senha original funciona em staging (se bcrypt importado)
- [ ] Template de comunicação de reset preparado (caso necessário)
- [ ] Canal de suporte definido para primeiras 4h pós-go-live

---

### BU2 — Push notifications podem expirar — notificação de migração preparada? 🟡

**Descrição**: Alguns dispositivos podem ter subscriptions de push expiradas. Após a migração,
notificações podem não chegar em todos os dispositivos. Usuários podem precisar reabrir o app.

**Ação necessária**:
```
Preparar comunicação proativa:
- Push de "teste" enviada às primeiras 24h pós-go-live para identificar devices ativos
- Mensagem in-app na próxima abertura: "Sistema atualizado com sucesso!"
```

**Responsável**: Marketing/Produto
**Prazo**: D-1
- [ ] Comunicação de pós-migração preparada

---

### BU3 — Features de AI estarão degradadas (se Opção B) — comunicação necessária 🟡

**Descrição**: Se a decisão for aceitar degradação das funções de AI (Opção B), usuários que
dependem dessas features precisam ser avisados antes ou imediatamente após a migração.

**Features afetadas** (se Opção B):
```
- Geração automática de contratos (AI)
- Preenchimento automático de contratos (AI)
- Resumo automático de leads
- Análise de qualidade de fotos
- Extração de dados de PDF
```

**Ação necessária** (apenas se Opção B):
```
- Identificar usuários que usam features de AI ativamente
- Preparar comunicação: "Funcionalidade temporariamente indisponível — prazo de retorno: X"
- Documentar prazo para code fix pós-migração
```

**Responsável**: Produto/Marketing (se Opção B for escolhida)
**Prazo**: D-1 (se Opção B confirmada)
- [ ] Decisão documentada (Opção A ou B)
- [ ] Se Opção B: comunicação preparada para usuários afetados

---

## RESUMO CONSOLIDADO — Status dos Blockers

### Verificação Rápida (pré-go-live)

| Blocker | Categoria | Severidade | Status |
|---------|-----------|-----------|--------|
| BT1 — pg_net ALTER DATABASE SET | Técnico | 🔴 Blocker | [ ] |
| BT2 — UUID remapping script | Técnico | 🔴 Blocker | [ ] |
| BT3 — LOVABLE_API_KEY decisão | Técnico | 🔴 Blocker | [ ] |
| BT4 — pg_cron/pg_net no Dashboard | Técnico | 🟡 | [ ] |
| BT5 — config.toml atualizado | Técnico | 🔴 Blocker | [ ] |
| BO1 — Novo projeto criado | Operacional | 🔴 Blocker | [ ] |
| BO2 — 30+ secrets configurados | Operacional | 🔴 Blocker | [ ] |
| BO3 — Staging testado | Operacional | 🟡 | [ ] |
| BI1 — Meta redirect_uri | Integração | 🔴 Blocker | [ ] |
| BI2 — RD Station redirect_uri | Integração | 🔴 Blocker | [ ] |
| BI3 — Asaas preparado | Integração | 🟡 | [ ] |
| BI4 — Easypanel preparado | Integração | 🟡 | [ ] |
| BS1 — Audit error handling AI | Segurança | 🔴 Blocker | [ ] |
| BS2 — DNS/domínio verificado | Segurança | 🟡 | [ ] |
| BU1 — Comunicação usuários | UX | 🟡 | [ ] |
| BU2 — Push notifications | UX | 🟡 | [ ] |
| BU3 — AI degradação comunicada | UX | 🟡 (se Opção B) | [ ] |

### Decisão Go/No-Go

```
Data da verificação: _______________
Bloqueadores 🔴 resolvidos: ___ / 8
Bloqueadores 🟡 resolvidos: ___ / 9

DECISÃO: [ ] GO — todos os 🔴 OK  [ ] NO-GO — blockers abertos: _______________
Responsável pela decisão: _______________
```

---

*Documento versão 1.0 — 2026-03-18*
*Anterior: [LOVABLE_CONFIRMATIONS_IMPACT.md](./LOVABLE_CONFIRMATIONS_IMPACT.md)*
*Checklist de validação: [FINAL_VALIDATION_CHECKLIST.md](./FINAL_VALIDATION_CHECKLIST.md)*

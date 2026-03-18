# Checklist de Validação Final — Habitae
## Migração Lovable Cloud → Supabase Próprio

**Versão**: 1.1
**Data de elaboração**: 2026-03-18
**Última revisão**: 2026-03-18 (incorporação de confirmações técnicas do Lovable)
**Usar em**: Pós-deploy, pré-go-live e imediatamente após go-live

---

## Como usar este checklist

- Executar **cada item** na sequência
- Marcar `[x]` apenas quando o resultado esperado foi confirmado
- Se qualquer item falhar: **PARAR** e investigar antes de continuar
- Itens marcados com 🔴 são **blockers** — falha = não fazer go-live
- Itens marcados com 🟡 são **importantes** — falha = investigar antes de go-live
- Itens marcados com 🟢 são **verificações de saúde** — falha pode ser resolvida pós go-live

```
Variáveis usadas neste checklist (substituir pelos valores reais):
  NEW_PROJECT_ID = novo project id do Supabase
  NEW_ANON_KEY   = novo anon/public key
  NEW_DB_URL     = connection string do novo projeto
  ACCESS_TOKEN   = JWT de usuário de teste (obter via login na seção 2)
  ORG_ID         = UUID de organização de teste
```

---

## BLOCO 1 — Banco de Dados

### 1.1 Conectividade 🔴

```bash
# Teste de conexão básica
psql "$NEW_DB_URL" -c "SELECT version();"
```
- [ ] Conexão estabelecida sem erro
- [ ] Versão do PostgreSQL exibida

### 1.2 Schema — Tabelas criadas 🔴

```sql
SELECT count(*) as total_tables
FROM pg_tables
WHERE schemaname = 'public';
-- Esperado: ~47 tabelas
```
- [ ] Total de tabelas >= 45 (variação de ±2 aceitável se tabelas de log forem omitidas)

```sql
-- Verificar tabelas críticas de negócio
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations', 'profiles', 'user_roles', 'properties',
    'leads', 'contracts', 'commissions', 'invoices', 'transactions',
    'subscriptions', 'subscription_plans', 'ad_accounts',
    'rd_station_settings', 'push_subscriptions', 'imobzi_settings'
  )
ORDER BY tablename;
-- Esperado: 15 linhas (todas as tabelas listadas)
```
- [ ] Todas as 15 tabelas críticas existem

### 1.3 Schema — Enums criados 🔴

```sql
SELECT typname FROM pg_type
WHERE typtype = 'e'
ORDER BY typname;
-- Verificar que enums como lead_status, property_status, etc. existem
```
- [ ] Pelo menos 5 tipos enum listados

### 1.4 RLS habilitado nas tabelas sensíveis 🔴

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'profiles', 'properties', 'leads', 'contracts', 'transactions')
ORDER BY tablename;
-- Esperado: rowsecurity = true para TODAS
```
- [ ] `organizations` — RLS = true
- [ ] `profiles` — RLS = true
- [ ] `properties` — RLS = true
- [ ] `leads` — RLS = true
- [ ] `contracts` — RLS = true
- [ ] `transactions` — RLS = true

### 1.5 Policies de RLS criadas 🔴

```sql
SELECT count(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public';
-- Esperado: >50 policies
```
- [ ] Total de policies > 50

### 1.6 Contagem de dados — comparação com origem 🔴

```sql
-- Executar no NOVO projeto e comparar com valores anotados na exportação
SELECT
  'organizations' as tbl, count(*) FROM organizations
UNION ALL
SELECT 'profiles', count(*) FROM profiles
UNION ALL
SELECT 'properties', count(*) FROM properties
UNION ALL
SELECT 'leads', count(*) FROM leads
UNION ALL
SELECT 'contracts', count(*) FROM contracts
UNION ALL
SELECT 'commissions', count(*) FROM commissions
UNION ALL
SELECT 'transactions', count(*) FROM transactions
UNION ALL
SELECT 'invoices', count(*) FROM invoices;
```
- [ ] `organizations` — contagem = origem (diferença 0)
- [ ] `profiles` — contagem = origem (diferença 0)
- [ ] `properties` — contagem ≈ origem (diferença ≤ 1%)
- [ ] `leads` — contagem ≈ origem (diferença ≤ 1%)
- [ ] `contracts` — contagem = origem (diferença 0)
- [ ] `commissions` — contagem = origem (diferença 0)

### 1.7 Integridade referencial — FK violations 🔴

```sql
-- Verificar que não há FK violations após importação
-- profiles referenciando auth.users inexistentes
SELECT count(*) as orphan_profiles
FROM profiles p
WHERE p.user_id NOT IN (SELECT id FROM auth.users);
-- Esperado: 0

SELECT count(*) as orphan_roles
FROM user_roles ur
WHERE ur.user_id NOT IN (SELECT id FROM auth.users);
-- Esperado: 0

SELECT count(*) as orphan_leads
FROM leads l
WHERE l.broker_id IS NOT NULL
  AND l.broker_id NOT IN (SELECT id FROM auth.users);
-- Esperado: 0
```
- [ ] 0 profiles órfãos (sem auth.user correspondente)
- [ ] 0 user_roles órfãos
- [ ] 0 leads com broker_id inválido

### 1.8 Teste de escrita 🔴

```sql
-- Criar e deletar registro de teste (verifica que DB aceita writes)
INSERT INTO organizations (id, name, slug, created_at)
VALUES (gen_random_uuid(), '__TESTE_MIGRACAO__', '__teste_migracao__', NOW())
RETURNING id;

-- Anotar o UUID retornado e deletar
DELETE FROM organizations WHERE slug = '__teste_migracao__';
-- Esperado: DELETE 1
```
- [ ] INSERT executou sem erro
- [ ] DELETE executou sem erro (0 registros fantasma)

### 1.9 Functions e Triggers 🟡

```sql
-- Verificar que functions personalizadas existem
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
-- Deve listar functions como: get_user_organizations, handle_new_user, etc.

-- Verificar triggers
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```
- [ ] Pelo menos 3 functions customizadas existem
- [ ] Triggers estão presentes nas tabelas que os exigem

---

## BLOCO 2 — Autenticação

### 2.1 Login de usuário existente 🔴

```bash
# Usar credenciais de usuário real migrado
curl -X POST \
  "https://$NEW_PROJECT_ID.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: $NEW_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "USUARIO_REAL@DOMINIO.com", "password": "HabitaeMigration2026!Temp"}' \
  | jq '{access_token: .access_token[:30], user_id: .user.id, email: .user.email}'
```
- [ ] Retorna `access_token` não-nulo
- [ ] Retorna `user.id` (UUID)
- [ ] Retorna `user.email` correto
- [ ] Guardar `access_token` como `ACCESS_TOKEN` para os próximos testes

### 2.2 Refresh de token 🔴

```bash
# Usar refresh_token do login anterior
curl -X POST \
  "https://$NEW_PROJECT_ID.supabase.co/auth/v1/token?grant_type=refresh_token" \
  -H "apikey: $NEW_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\": \"$REFRESH_TOKEN\"}" | jq .access_token | head -c 50
```
- [ ] Novo `access_token` gerado com sucesso

### 2.3 JWT válido e decodificável 🔴

```bash
# Decodificar o JWT (sem verificar assinatura, apenas checar estrutura)
echo $ACCESS_TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('sub:', d['sub']); print('role:', d['role']); print('exp:', d['exp'])"
```
- [ ] `sub` = UUID do usuário
- [ ] `role` = "authenticated"
- [ ] `exp` = timestamp futuro (não expirado)

### 2.4 Usuários auth.users contagem 🔴

```sql
-- Comparar com número de usuários exportados do projeto antigo
SELECT count(*) as total_users
FROM auth.users
WHERE deleted_at IS NULL;
-- Esperado: mesmo número do CSV de exportação
```
- [ ] Contagem de usuários = exportação do projeto antigo

### 2.5 Verificar que senhas funcionam (não apenas temporária) 🟡

```bash
# Se algum usuário tiver senha original (não a temporária)
# Ex: usuário admin que você conhece a senha
curl -X POST \
  "https://$NEW_PROJECT_ID.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: $NEW_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@habitae.com.br", "password": "SENHA_ORIGINAL_SE_CONHECIDA"}'
```
- [ ] Login com senha original funciona (se aplicável)
- [ ] Login com senha temporária funciona para usuários migrados

---

## BLOCO 3 — RLS e Isolamento Multi-Tenant

### 3.1 Isolamento de organização — leitura 🔴

```bash
# Usuário da Org A NÃO deve ver dados da Org B
# Assumindo que ACCESS_TOKEN é de usuário da Org A

# Buscar properties da Org A (deve retornar dados)
curl -s "https://$NEW_PROJECT_ID.supabase.co/rest/v1/properties?limit=5" \
  -H "apikey: $NEW_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq 'length'
# Esperado: número > 0 (se Org A tem imóveis)

# Verificar que TODOS os resultados pertencem à mesma organização
curl -s "https://$NEW_PROJECT_ID.supabase.co/rest/v1/properties?select=id,organization_id&limit=50" \
  -H "apikey: $NEW_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | \
  jq '[.[].organization_id] | unique | length'
# Esperado: 1 (todos da mesma org)
```
- [ ] Properties retornam dados
- [ ] Todos os results pertencem a 1 única organização

### 3.2 Isolamento de organização — org diferente retorna vazio 🔴

```sql
-- Via psql com role authenticated simulada
-- (requer acesso direto ao DB)
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO
  '{"sub": "UUID_USUARIO_ORG_A", "role": "authenticated", "aud": "authenticated"}';

SELECT count(*) FROM properties
WHERE organization_id = 'UUID_ORG_B_DIFERENTE';
-- Esperado: 0 (RLS deve bloquear)
```
- [ ] Query retorna 0 rows para organização diferente

### 3.3 Admin_allowlist — funções admin bloqueadas para usuário normal 🔴

```bash
# Tentar acessar admin-users com token de usuário normal (não admin)
curl -X GET "https://$NEW_PROJECT_ID.supabase.co/functions/v1/admin-users" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "list"}' | jq .
# Esperado: {"error": "Forbidden"} ou {"error": "Not authorized"}
# NÃO deve retornar lista de usuários!
```
- [ ] Usuário normal não tem acesso a admin-users
- [ ] Resposta de erro clara (não lista de dados)

### 3.4 SERVICE_ROLE bypassa RLS (esperado) 🟡

```bash
# SERVICE_ROLE deve ter acesso a todos os dados (para funções de admin)
curl -s "https://$NEW_PROJECT_ID.supabase.co/rest/v1/organizations" \
  -H "apikey: $NEW_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $NEW_SERVICE_ROLE_KEY" | jq 'length'
# Esperado: total de organizações no sistema
```
- [ ] SERVICE_ROLE vê todos os dados sem restrição de RLS

---

## BLOCO 4 — Edge Functions Críticas

### 4.1 Health check — funções de auth 🔴

```bash
# platform-signup (retornar erro de validação, não 500)
curl -X POST "https://$NEW_PROJECT_ID.supabase.co/functions/v1/platform-signup" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .error
# Esperado: mensagem de erro de validação (não "Internal Server Error")

# send-reset-email (retornar erro de validação, não 500)
curl -X POST "https://$NEW_PROJECT_ID.supabase.co/functions/v1/send-reset-email" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .error
# Esperado: "Missing email" ou similar
```
- [ ] `platform-signup` retorna erro de validação (não 500)
- [ ] `send-reset-email` retorna erro de validação (não 500)

### 4.2 Health check — billing 🔴

```bash
# billing (autenticado)
curl -X POST "https://$NEW_PROJECT_ID.supabase.co/functions/v1/billing" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_customer"}' | jq .
# Esperado: dados do customer Asaas ou {"customer": null} — NÃO 500
```
- [ ] `billing` retorna resposta válida (não 500)

### 4.3 Health check — storage 🔴

```bash
# r2-presign (gerar URL de upload)
curl -X POST "https://$NEW_PROJECT_ID.supabase.co/functions/v1/r2-presign" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test_health.jpg", "contentType": "image/jpeg", "organization_id": "'$ORG_ID'"}' | jq .
# Esperado: {url: "https://...", key: "..."}
```
- [ ] `r2-presign` retorna URL presignada válida

### 4.4 Health check — notificações 🟡

```bash
# onesignal-app-id
curl "https://$NEW_PROJECT_ID.supabase.co/functions/v1/onesignal-app-id" | jq .app_id
# Esperado: string com App ID do OneSignal (não null)
```
- [ ] `onesignal-app-id` retorna app_id correto

### 4.5 Health check — integração Meta 🟡

```bash
# meta-app-id
curl "https://$NEW_PROJECT_ID.supabase.co/functions/v1/meta-app-id" | jq .app_id
# Esperado: string com App ID do Facebook (não null)
```
- [ ] `meta-app-id` retorna app_id correto

### 4.6 Health check — AI 🟡

```bash
# test-ai-connection
curl "https://$NEW_PROJECT_ID.supabase.co/functions/v1/test-ai-connection" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
# Esperado: objeto com status de cada provider
# groq: "ok", google: "ok", openai: (ok ou skipped)
```
- [ ] Pelo menos 1 provider de AI respondendo (groq OU google)
- [ ] Nenhum provider retornando erro 500

### 4.8 Verificar ausência de chamadas ao gateway Lovable 🔴

```bash
# Verificar logs de funções AI — NÃO deve haver tentativas de acesso a ai.gateway.lovable.dev
supabase functions logs validate-document --project-ref $NEW_PROJECT_ID | grep "lovable.dev"
supabase functions logs generate-contract-template --project-ref $NEW_PROJECT_ID | grep "lovable.dev"
supabase functions logs summarize-lead --project-ref $NEW_PROJECT_ID | grep "lovable.dev"
# Esperado: ZERO ocorrências — se aparecer, indica que o código não foi migrado (Opção A)
# e as funções estão falhando silenciosamente ou com erro 401
```
- [ ] Nenhum log menciona `ai.gateway.lovable.dev` com falha de autenticação
- [ ] Se Opção B (degradação aceita): confirmar que decision está documentada e aprovada

### 4.7 Verificar que funções com verify_jwt=true rejeitam requisição sem token 🔴

```bash
# billing (verify_jwt=true) sem Authorization header
curl -X POST "https://$NEW_PROJECT_ID.supabase.co/functions/v1/billing" \
  -H "Content-Type: application/json" \
  -d '{"action": "test"}' | jq .
# Esperado: {"error": "Unauthorized"} ou HTTP 401

# crm-import-leads (verify_jwt=true) sem Authorization header
curl -X POST "https://$NEW_PROJECT_ID.supabase.co/functions/v1/crm-import-leads" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
# Esperado: HTTP 401
```
- [ ] `billing` sem token retorna 401
- [ ] `crm-import-leads` sem token retorna 401

---

## BLOCO 5 — Frontend

### 5.1 Build compila sem erros 🔴

```bash
cd /home/user/habitae1-a90a7927

# Verificar que variáveis de ambiente estão configuradas
echo "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}"
echo "VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY:0:30}..."
echo "VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID}"

# Build
bun run build 2>&1 | tail -20
```
- [ ] `bun run build` retorna exit code 0
- [ ] Sem erros TypeScript
- [ ] Sem erros de build críticos (warnings são aceitáveis)

### 5.2 Bundle aponta para novo projeto 🔴

```bash
# Verificar que o bundle compilado contém o novo project URL
grep -r "aiflfkkjitvsyszwdfga" dist/
# Esperado: NENHUMA ocorrência (o antigo project ID não deve estar no bundle)

grep -r "$NEW_PROJECT_ID" dist/ | head -3
# Esperado: pelo menos 1 ocorrência (novo project ID no bundle)
```
- [ ] Project ID antigo NÃO está no bundle
- [ ] Project ID novo ESTÁ no bundle

### 5.3 App carrega no browser 🔴

```
Ação manual: Abrir https://portadocorretor.com.br no browser (modo incógnito)
```
- [ ] Página de login carrega sem erro (não tela branca)
- [ ] Console do browser (F12) sem erros JavaScript críticos
- [ ] Console não mostra "Failed to fetch" para assets críticos

### 5.4 Login no frontend funciona 🔴

```
Ação manual: Fazer login com usuário real migrado
```
- [ ] Login aceito (não retorna erro)
- [ ] Redirecionamento para dashboard após login
- [ ] Dados da organização carregam no dashboard

### 5.5 PWA service worker registrado 🟡

```
Ação manual: DevTools → Application → Service Workers
```
- [ ] Service worker está registrado e ativo
- [ ] Status: "activated and is running"

### 5.6 Redirect de URL antiga funciona (manter — NÃO remover) 🟡

```
Ação manual: Abrir https://habitae1.lovable.app no browser (modo incógnito)
```
- [ ] Redireciona automaticamente para `https://portadocorretor.com.br`
- [ ] Redirect não causa loop (verifica pathname, search e hash)

> ℹ️ Este redirect (`src/main.tsx` linhas 72-83) é INTENCIONAL e BENÉFICO — protege usuários que
> acessem o URL antigo. NÃO remover em nenhuma circunstância.

---

## BLOCO 6 — Integrações

### 6.1 Asaas — webhook configurado 🔴

```bash
# Verificar nos logs da função que webhook está recebendo (após configurar no painel Asaas)
supabase functions logs billing-webhook --project-ref $NEW_PROJECT_ID | tail -10
# Após enviar evento de teste pelo painel Asaas
```
- [ ] Evento de teste recebido e logado sem erro 500
- [ ] URL do webhook no painel Asaas aponta para novo projeto

### 6.2 Cloudflare R2 — upload e acesso funcionam 🔴

```bash
# 1. Obter presigned URL
PRESIGN=$(curl -s -X POST "https://$NEW_PROJECT_ID.supabase.co/functions/v1/r2-presign" \
  -d '{"filename": "validation_test.txt", "contentType": "text/plain"}')
UPLOAD_URL=$(echo $PRESIGN | jq -r '.url')
echo "Upload URL: ${UPLOAD_URL:0:80}..."

# 2. Fazer upload
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: text/plain" \
  -d "Habitae Migration Test - $(date)"

# 3. Verificar que arquivo está acessível publicamente
PUBLIC_KEY=$(echo $PRESIGN | jq -r '.key')
curl -I "$R2_PUBLIC_URL/$PUBLIC_KEY"
# Esperado: HTTP 200
```
- [ ] Presigned URL gerada com sucesso
- [ ] Upload para R2 retornou 200
- [ ] Arquivo acessível via URL pública

### 6.3 OneSignal — push notification enviada 🟡

```bash
# Enviar push de teste (requer device registrado)
curl -X POST "https://$NEW_PROJECT_ID.supabase.co/functions/v1/notifications-test" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Teste Migração", "body": "Sistema migrado com sucesso!"}' | jq .
```
- [ ] Função retorna 200 (não 500)
- [ ] Push recebida no device de teste (verificar fisicamente)

### 6.4 Meta Ads — redirect_uri configurado 🟡

```
Ação manual: Verificar no Facebook App Developers
```
- [ ] Novo redirect_uri está na lista de URIs válidos
- [ ] URI antiga ainda está na lista (para rollback)

### 6.5 RD Station — redirect_uri configurado 🟡

```
Ação manual: Verificar no painel RD Station
```
- [ ] Novo redirect_uri está configurado
- [ ] URI antiga ainda está disponível para rollback

### 6.6 WhatsApp (UAZAPI) — EDGE_BASE_URL atualizado 🔴 (se WhatsApp em uso)

```
Ação manual: Verificar no Easypanel
```
- [ ] EDGE_BASE_URL aponta para novo projeto
- [ ] Serviço wa-worker reiniciado e rodando

---

## BLOCO 7 — Performance e Observabilidade

### 7.1 Latência de API aceitável 🟡

```bash
# Medir tempo de resposta para operações comuns
time curl -s "https://$NEW_PROJECT_ID.supabase.co/rest/v1/properties?limit=10" \
  -H "apikey: $NEW_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" > /dev/null
# Esperado: < 1000ms para região sa-east-1

time curl -s "https://$NEW_PROJECT_ID.supabase.co/functions/v1/onesignal-app-id" > /dev/null
# Esperado: < 500ms (cold start incluído: < 3000ms)
```
- [ ] REST API respondendo em < 1s
- [ ] Edge functions respondendo em < 3s (inclui cold start)

### 7.2 Dashboard de logs funcionando 🟡

```
Ação manual: Supabase Dashboard → Logs → API Logs
```
- [ ] Logs visíveis e em tempo real
- [ ] Sem flood de erros 5xx nos logs

### 7.3 Sem FK violations ativas 🔴

```sql
-- Verificação final de integridade após todos os dados importados
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  COUNT(*) as violations
FROM
  information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
-- Não há SQL padrão para verificar violations — usar queries específicas por tabela
-- Ver Bloco 1.7 para queries específicas
;
```
- [ ] Re-confirmar: 0 FK violations (re-executar queries do Bloco 1.7)

---

## BLOCO 8 — Segurança

### 8.1 Secrets não expostos no frontend 🔴

```bash
# SERVICE_ROLE KEY não deve estar no bundle do frontend
grep -r "service_role" dist/ 2>/dev/null
# Esperado: NENHUMA ocorrência

# ASAAS_API_KEY não deve estar no bundle
grep -r "ASAAS_API_KEY" dist/ 2>/dev/null
# Esperado: NENHUMA ocorrência
```
- [ ] SERVICE_ROLE KEY não está no bundle
- [ ] Nenhuma API key de backend no bundle

### 8.2 CORS — origens não autorizadas rejeitadas 🟡

```bash
# Verificar que CORS rejeita origem não autorizada
curl -s "https://$NEW_PROJECT_ID.supabase.co/functions/v1/r2-presign" \
  -H "Origin: https://site-malicioso.com" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.jpg"}' -I | grep -i "access-control-allow-origin"
# Esperado: null ou header específico (não "*" para funções com CORS restritivo)
```
- [ ] CORS não permite todas as origens arbitrárias

### 8.3 Rate limiting — verificar configuração 🟢

```
Ação manual: Supabase Dashboard → Settings → API → Rate Limiting
```
- [ ] Rate limiting está configurado (ou documentado que não está)

---

## BLOCO 9 — Operações Pós-Go-Live

### 9.1 Comunicação enviada aos usuários 🟡

```
Ação manual: Enviar push/email para usuários sobre:
- Sistema atualizado com sucesso
- Como redefinir senha (se necessário)
- Canal de suporte em caso de problemas
```
- [ ] Comunicação enviada
- [ ] Canal de suporte monitorado

### 9.2 Monitoramento ativo nas primeiras 2h 🔴

```bash
# Manter terminal aberto com logs em tempo real
supabase functions logs --project-ref $NEW_PROJECT_ID --tail

# Em outro terminal: monitorar logs de DB (via pgAudit ou Supabase logs)
# Dashboard → Logs → Postgres Logs
```
- [ ] Terminal com logs aberto e monitorado
- [ ] Responsável designado para monitoramento por 2h
- [ ] Número de contato do engenheiro de plantão disponível

### 9.3 Decisão de rollback documentada 🔴

```
- Janela de rollback: até 2h após go-live
- Gatilhos documentados em ROLLBACK_PLAN.md
- Responsável pela decisão de rollback: _______________
- Horário máximo para decisão: ___:___ (go-live + 2h)
```
- [ ] Responsável pela decisão de rollback designado
- [ ] Horário máximo documentado
- [ ] Time ciente dos critérios de rollback

### 9.4 Backup do novo estado confirmado 🟡

```bash
# Após go-live e validação, criar backup do novo projeto
pg_dump "$NEW_DB_URL" \
  --schema-only \
  --no-owner \
  -f "backup_post_migration_schema_$(date +%Y%m%d_%H%M%S).sql"

pg_dump "$NEW_DB_URL" \
  --data-only \
  --no-owner \
  -f "backup_post_migration_data_$(date +%Y%m%d_%H%M%S).sql"
```
- [ ] Backup pós-migração criado e armazenado

---

## BLOCO 10 — pg_net e Triggers (Crítico — Confirmação Técnica Lovable)

> Este bloco verifica o problema identificado no migration `20260317204734_fca31fcd.sql`:
> o trigger `trigger_push_on_notification` possui fallback hardcoded para `aiflfkkjitvsyszwdfga.supabase.co`.
> Se os GUC settings não forem configurados, o trigger tentará enviar push ao projeto ANTIGO.

### 10.1 GUC settings configurados no novo projeto 🔴

```sql
-- Verificar que os GUC settings foram configurados
SELECT
  current_setting('app.settings.supabase_url') AS supabase_url,
  left(current_setting('app.settings.supabase_anon_key'), 30) || '...' AS anon_key_preview;
-- Esperado:
--   supabase_url = https://NOVO_PROJECT_ID.supabase.co (NÃO aiflfkkjitvsyszwdfga)
--   anon_key_preview = eyJ... (chave do NOVO projeto)
```
- [ ] `app.settings.supabase_url` aponta para o NOVO projeto (não para `aiflfkkjitvsyszwdfga`)
- [ ] `app.settings.supabase_anon_key` é a chave do NOVO projeto

### 10.2 Trigger push aponta para novo projeto 🔴

```bash
# Testar o trigger inserindo uma notificação de teste
psql "$NEW_DB_URL" -c "
  INSERT INTO notifications (user_id, title, body, organization_id, type)
  SELECT id, 'Teste Migração', 'Trigger pg_net OK', '$ORG_ID', 'info'
  FROM auth.users LIMIT 1
  RETURNING id;
"
# Aguardar 5 segundos e verificar nos logs da função push-notification
sleep 5
supabase functions logs push-notification --project-ref $NEW_PROJECT_ID | tail -20
# Esperado: log mostrando que a requisição chegou ao NOVO projeto (não erro de URL antiga)
```
- [ ] Notificação de teste inserida com sucesso
- [ ] Log da função `push-notification` registrado no NOVO projeto (confirma que pg_net apontou corretamente)
- [ ] Nenhum erro de "connection refused" ou "unauthorized" nos logs (indicaria URL antiga)

### 10.3 pg_cron extension habilitada 🟡

```sql
-- Verificar que pg_cron está instalada e ativa
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net');
-- Esperado: 2 linhas (ambas instaladas)
```
- [ ] `pg_cron` extension presente
- [ ] `pg_net` extension presente

```sql
-- Verificar que não há jobs cron pendentes de configuração
SELECT count(*) FROM cron.job;
-- Esperado: 0 (nenhum cron job foi definido no projeto — confirmado por análise do código)
```
- [ ] 0 cron jobs (confirmado que não havia jobs no projeto original)

### 10.4 Push notification chegou no device 🟡

```
Ação manual: Verificar no device de teste (smartphone) se a push notification
de teste (inserida no 10.2) chegou.
```
- [ ] Push notification recebida no device de teste
- [ ] Conteúdo correto (título e body como inserido)

---

## RESUMO EXECUTIVO

### Antes do Go-Live (todos os 🔴 devem estar marcados)

**Banco de Dados:**
- [ ] 1.1 Conectividade
- [ ] 1.2 Tabelas criadas
- [ ] 1.4 RLS habilitado
- [ ] 1.6 Contagens batem
- [ ] 1.7 Zero FK violations
- [ ] 1.8 Escrita funciona

**Auth:**
- [ ] 2.1 Login funciona
- [ ] 2.2 Refresh funciona
- [ ] 2.3 JWT estrutura correta
- [ ] 2.4 Contagem de usuários correta

**RLS:**
- [ ] 3.1 Isolamento por org funciona
- [ ] 3.2 Org diferente retorna vazio
- [ ] 3.3 Admin functions bloqueadas para usuário normal

**Edge Functions:**
- [ ] 4.1 Auth functions saudáveis
- [ ] 4.2 Billing saudável
- [ ] 4.3 Storage saudável
- [ ] 4.7 Funções com JWT rejeitam sem token
- [ ] 4.8 Nenhum log menciona `ai.gateway.lovable.dev` com falha

**Frontend:**
- [ ] 5.1 Build compila
- [ ] 5.2 Bundle usa novo projeto
- [ ] 5.3 App carrega em `portadocorretor.com.br`
- [ ] 5.4 Login no frontend funciona

**pg_net e Triggers:**
- [ ] 10.1 GUC `app.settings.supabase_url` aponta para NOVO projeto
- [ ] 10.2 Trigger push disparou para NOVO projeto (log confirmado)

**Integrações:**
- [ ] 6.1 Asaas webhook configurado e testado
- [ ] 6.2 R2 upload e acesso funcionam

**Segurança:**
- [ ] 8.1 Nenhum secret de backend no bundle frontend

### Resultado Final

```
Data/Hora da validação: _______________
Validado por: _______________
Status: [ ] APROVADO PARA GO-LIVE  [ ] BLOQUEADO — motivo: _______________
```

---

*Documento gerado em: 2026-03-18*
*Anterior: [INTEGRATIONS_MIGRATION_PLAN.md](./INTEGRATIONS_MIGRATION_PLAN.md)*
*Voltar ao início: [MIGRATION_EXECUTION_PLAN.md](./MIGRATION_EXECUTION_PLAN.md)*

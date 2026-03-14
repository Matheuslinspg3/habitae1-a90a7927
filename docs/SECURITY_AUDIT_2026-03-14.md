# 🔒 Relatório de Auditoria de Segurança — Habitae ERP Imobiliário

**Data:** 2026-03-14  
**Tipo:** Avaliação completa de segurança (AppSec + Cloud + DB + Frontend)  
**Escopo:** 84 tabelas, 259 políticas RLS, 60+ Edge Functions, Frontend React/TypeScript  

---

## 1. VISÃO GERAL DO RISCO

### Score Geral: 7.2/10 (BOM, com pontos de atenção)

O sistema demonstra maturidade acima da média para SaaS B2B em Supabase:
- ✅ RLS habilitado em todas as tabelas com `organization_id`
- ✅ Funções auxiliares SECURITY DEFINER com `search_path` fixo
- ✅ Hierarquia RBAC implementada via `user_roles` separada de `profiles`
- ✅ Auditoria avançada com `audit_events` (27 campos) + triggers automáticos
- ✅ Proteção anti-escalação na tabela `user_roles` (não permite inserir `developer`)
- ✅ Edge Functions com validação de JWT manual e verificação de role
- ✅ Billing webhook com HMAC/token + idempotência + sanitização de payload
- ✅ LGPD compliance com consent-gated analytics (Clarity)

**Principais Gaps:**
- 🔴 2 vulnerabilidades de exposição de dados confirmadas pelo scanner
- 🟡 35+ Edge Functions com `verify_jwt = false` (risco aumentado)
- 🟡 Tokens OAuth (Meta/RD Station) em texto plano no banco
- 🟡 Falta de rate limiting em Edge Functions

---

## 2. MAPA DE AMEAÇAS POR PRIORIDADE

### 🔴 CRÍTICA (Corrigir em < 1 semana)

#### C1: PII de proprietários exposta no marketplace
- **Tabela:** `marketplace_properties`
- **Problema:** A policy SELECT permite que qualquer usuário autenticado veja `owner_name`, `owner_phone`, `owner_email`, `commission_percentage` quando `status = 'disponivel'`
- **Impacto:** Vazamento de dados pessoais de proprietários para organizações concorrentes. Violação da LGPD.
- **Evidência:** Scan detectou `EXPOSED_SENSITIVE_DATA`
- **Correção:**
```sql
-- Remover a policy cross-org atual e criar uma mais restritiva
DROP POLICY "Authenticated users can view available marketplace properties (" ON marketplace_properties;

CREATE POLICY "Cross-org marketplace read (sem PII)"
ON marketplace_properties FOR SELECT TO authenticated
USING (
  (organization_id = get_user_organization_id())
  OR (
    status = 'disponivel'
    -- Não bloqueia o SELECT, mas as colunas sensíveis devem ser
    -- tratadas via view ou column-level security
  )
);

-- Alternativa mais segura: criar uma VIEW sem PII para cross-org
CREATE OR REPLACE VIEW marketplace_properties_safe AS
SELECT id, title, description, property_type_id, transaction_type,
       sale_price, rent_price, bedrooms, suites, bathrooms, parking_spots,
       area_total, area_built, status, is_featured, images, amenities,
       address_neighborhood, address_city, address_state,
       organization_id, created_at, updated_at
FROM marketplace_properties
WHERE status = 'disponivel';
```

#### C2: AI Usage Logs — INSERT sem restrição de user_id/org
- **Tabela:** `ai_usage_logs`
- **Problema:** `WITH CHECK: true` permite qualquer autenticado inserir logs atribuídos a qualquer user/org
- **Impacto:** Falsificação de métricas de custo, potencial para inflar custos de IA de outra organização
- **Correção:**
```sql
DROP POLICY "Authenticated users can insert ai_usage_logs" ON ai_usage_logs;

CREATE POLICY "Users can insert own ai_usage_logs"
ON ai_usage_logs FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (organization_id IS NULL OR organization_id = get_user_organization_id())
);
```

### 🟠 ALTA (Corrigir em < 2 semanas)

#### A1: Verification Codes — criação anônima para qualquer email
- **Tabela:** `verification_codes`
- **Problema:** Branch `(user_id IS NULL AND email IS NOT NULL)` permite anônimos criar códigos para qualquer email
- **Impacto:** Enumeração de emails, spam, potencial abuso de verificação
- **Correção:**
```sql
DROP POLICY "Users can create verification codes" ON verification_codes;

CREATE POLICY "Authenticated users can create verification codes"
ON verification_codes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
```

#### A2: Imobzi API Keys acessíveis por todos os membros
- **Tabela:** `imobzi_api_keys`
- **Problema:** Qualquer membro da org (inclusive corretor/assistente) pode ler `api_key`
- **Impacto:** Exposição de credenciais de integração a usuários sem necessidade
- **Correção:**
```sql
DROP POLICY "Org members can view API keys" ON imobzi_api_keys;

CREATE POLICY "Managers can view API keys"
ON imobzi_api_keys FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND is_org_manager_or_above(auth.uid())
);

-- Também restringir INSERT e DELETE
DROP POLICY "Org members can insert API keys" ON imobzi_api_keys;
CREATE POLICY "Managers can insert API keys"
ON imobzi_api_keys FOR INSERT TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id()
  AND is_org_manager_or_above(auth.uid())
);

DROP POLICY "Org members can delete API keys" ON imobzi_api_keys;
CREATE POLICY "Managers can delete API keys"
ON imobzi_api_keys FOR DELETE TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND is_org_manager_or_above(auth.uid())
);
```

#### A3: OAuth tokens em texto plano
- **Tabelas:** `ad_accounts.auth_payload`, `rd_station_settings.oauth_access_token`, `rd_station_settings.oauth_refresh_token`
- **Problema:** Tokens OAuth armazenados sem criptografia no banco
- **Impacto:** Se houver SQL injection ou backup leak, todas as integrações são comprometidas
- **Mitigação atual:** RLS restringe acesso a gestores. O `auth_payload` não é selecionado no frontend (hook omite o campo)
- **Recomendação:** Migrar para Supabase Vault quando disponível. Enquanto isso, documentar como risco aceito com controles compensatórios

#### A4: Leaked Password Protection desabilitada
- **Problema:** O Supabase Auth não verifica se senhas foram vazadas em breaches conhecidos
- **Impacto:** Usuários podem usar senhas comprometidas
- **Correção:** Habilitar via configuração de autenticação do projeto

#### A5: 35+ Edge Functions com verify_jwt = false
- **Lista parcial:** `admin-users`, `platform-signup`, `send-push`, `meta-*`, `rd-station-*`, `export-database`, `toggle-maintenance-mode`, `generate-*`, `summarize-lead`, `validate-document`
- **Problema:** Sem verificação automática de JWT, dependem de validação manual
- **Mitigação existente:** A maioria faz validação manual do Bearer token (confirmado em `manage-member`, `admin-users`, `export-database`, `accept-invite`)
- **Risco residual:** Se alguma function não valida corretamente, fica aberta. Webhooks (`billing-webhook`, `rd-station-webhook`) são legitimamente `verify_jwt = false`
- **Recomendação:** Auditar TODAS as 35+ functions e documentar quais são legitimamente sem JWT (webhooks) vs. quais dependem de validação manual

### 🟡 MÉDIA (Corrigir em < 1 mês)

#### M1: Corretor pode inserir leads para qualquer org member
- **Tabela:** `leads`
- **Problema:** INSERT policy `organization_id = get_user_organization_id()` não valida `broker_id`
- **Impacto:** Corretor pode criar lead atribuído a outro corretor
- **Avaliação:** Baixo risco prático (assistentes/corretores criam leads normalmente), mas viola princípio do menor privilégio

#### M2: Qualquer membro pode deletar appointments
- **Tabela:** `appointments`
- **Problema:** DELETE policy usa apenas `is_member_of_org(organization_id)` sem checar role
- **Impacto:** Corretor ou assistente pode deletar agendamentos de outros membros
- **Correção:** Adicionar restrição por role ou `created_by = auth.uid()`

#### M3: Qualquer membro pode deletar properties
- **Tabela:** `properties`
- **Problema:** DELETE policy `is_member_of_org(organization_id)` sem restrição de role
- **Impacto:** Assistente (role de leitura) poderia deletar imóveis
- **Correção:**
```sql
DROP POLICY "Users can delete properties in their organization" ON properties;
CREATE POLICY "Managers can delete properties"
ON properties FOR DELETE TO authenticated
USING (
  is_member_of_org(organization_id)
  AND is_org_manager_or_above(auth.uid())
);
```

#### M4: Imobzi settings acessível a todos os membros
- **Tabela:** `imobzi_settings` (inclui `api_key_encrypted`)
- **Problema:** Policies usam `get_user_organization_id()` sem restrição de role
- **Recomendação:** Restringir a gestores

#### M5: User_roles UPDATE por leader sem verificação de hierarquia
- **Policy:** `Dev or leader can update roles`
- **Problema:** Um leader pode alterar o role de um admin para corretor
- **Recomendação:** Implementar verificação de hierarquia no UPDATE (similar ao INSERT que bloqueia `developer`)

#### M6: Falta de rate limiting nas Edge Functions
- **Problema:** Nenhuma Edge Function implementa rate limiting
- **Impacto:** Vulnerável a brute force em `send-reset-email`, `platform-signup`, `accept-invite`
- **Recomendação:** Implementar rate limiting via tabela de contagem ou KV store

#### M7: CORS com wildcard em várias Edge Functions
- **Problema:** `Access-Control-Allow-Origin: *` na maioria das functions
- **Mitigação parcial:** `admin-users` usa allowlist de origens
- **Recomendação:** Aplicar origin allowlist em todas as functions sensíveis

### 🟢 BAIXA (Backlog / Melhoria contínua)

#### B1: Function search_path mutable (alerta do linter)
- Algumas functions não definem `search_path`. Risco teórico de schema poisoning

#### B2: Extensions no schema public
- Extensões instaladas em `public` ao invés de schema dedicado

#### B3: Profile UPDATE sem restrição de campos
- **Problema:** `USING condition: (user_id = auth.uid())` permite usuário alterar seu `organization_id`
- **Mitigação:** O frontend não oferece essa opção, mas é explorável via API direta
- **Correção:**
```sql
-- Adicionar WITH CHECK para evitar que usuário altere organization_id
DROP POLICY "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update own profile (safe fields only)"
ON profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND organization_id IS NOT DISTINCT FROM (
    SELECT organization_id FROM profiles WHERE user_id = auth.uid()
  )
);
```

#### B4: Auditoria de login/logout não rastreada
- **Problema:** O sistema de auditoria (`audit_events`) rastreia CUD em leads/properties/contracts mas NÃO rastreia eventos de autenticação (login, falha de login, reset de senha)
- **Recomendação:** Usar Supabase Auth hooks ou Edge Function para capturar eventos de auth

#### B5: Falta de MFA
- **Problema:** Nenhuma implementação de MFA no sistema
- **Recomendação:** Considerar TOTP para roles admin/developer

---

## 3. ANÁLISE POR CAMADA

### 3.1 Autenticação
| Controle | Status | Nota |
|----------|--------|------|
| Login com email/senha | ✅ | Via Supabase Auth |
| Reset de senha | ✅ | Via Edge Function `send-reset-email` com Resend |
| Convites com email binding | ✅ | Validação em `accept-invite` e `platform-signup` |
| Sessão com JWT | ✅ | Gerenciado pelo Supabase |
| Proteção brute force | ⚠️ | Sem rate limiting customizado |
| Leaked password protection | ❌ | Desabilitado |
| MFA | ❌ | Não implementado |
| Auditoria de auth events | ❌ | Não rastreado |

### 3.2 Autorização (RBAC)
| Controle | Status | Nota |
|----------|--------|------|
| Hierarquia de roles | ✅ | developer > admin > sub_admin > leader > corretor > assistente |
| Anti-escalação INSERT | ✅ | `role <> 'developer'` na policy de user_roles |
| Anti-escalação UPDATE | ⚠️ | Leader pode alterar role de admin |
| Corretor isolado | ✅ | Vê apenas leads com `broker_id = auth.uid()` |
| Assistente read-only | ⚠️ | DELETE em properties/appointments não verifica role |
| Developer com auditoria | ✅ | `audit_events` com `acting_role` + `is_system_admin()` |

### 3.3 Multi-tenant
| Controle | Status | Nota |
|----------|--------|------|
| Filtro por org_id | ✅ | Via `get_user_organization_id()` e `is_member_of_org()` |
| SECURITY DEFINER com search_path | ✅ | Maioria das functions |
| Vazamento cross-org | 🔴 | marketplace_properties expõe PII |
| Edge Functions validam org | ✅ | `manage-member` verifica same-org |
| IDs previsíveis (UUIDs) | ✅ | Todos os IDs são UUIDv4 |

### 3.4 Storage/Uploads
| Controle | Status | Nota |
|----------|--------|------|
| Upload via proxy | ✅ | `r2-upload` com validação JWT |
| Validação de tipo/tamanho | ✅ | Definido em `lead_document_template_items` |
| Bucket público vs privado | ✅ | R2 com URLs controladas |
| Limpeza de órfãos | ✅ | `cleanup-orphan-media` + `deleted_property_media` |

### 3.5 Frontend
| Controle | Status | Nota |
|----------|--------|------|
| Route guards | ✅ | `ManagerRoute` com `isAdminOrAbove` |
| PII masking em Clarity | ✅ | `data-clarity-mask` em CRM/Financeiro |
| Consent-gated analytics | ✅ | LGPD compliant |
| Dados sensíveis em localStorage | ⚠️ | Sessão do Supabase armazenada (padrão SDK) |

### 3.6 Edge Functions
| Controle | Status | Nota |
|----------|--------|------|
| Auth validation | ✅ | Manual JWT validation na maioria |
| Role verification | ✅ | `manage-member`, `admin-users`, `export-database` |
| Org isolation | ✅ | Verificado em `manage-member` |
| Webhook auth | ✅ | `billing-webhook` com token HMAC + idempotência |
| Rate limiting | ❌ | Ausente em todas |
| CORS restrictive | ⚠️ | Apenas `admin-users` usa allowlist |

---

## 4. RECOMENDAÇÕES TÉCNICAS

### Quick Wins (< 1 dia cada)

1. **Habilitar Leaked Password Protection** no painel de autenticação
2. **Corrigir policy `ai_usage_logs`** — restringir INSERT a `user_id = auth.uid()`
3. **Restringir `imobzi_api_keys`** — SELECT apenas para gestores
4. **Corrigir `verification_codes`** — remover branch anônima
5. **Adicionar role check ao DELETE de `properties`** e `appointments`

### Médio Prazo (1-4 semanas)

6. **Implementar rate limiting** em `send-reset-email`, `platform-signup`, `accept-invite` via tabela de contagem
7. **Restringir CORS** em todas Edge Functions sensíveis (não apenas `admin-users`)
8. **Adicionar verificação de hierarquia** no UPDATE de `user_roles`
9. **Proteger profile UPDATE** contra alteração de `organization_id`
10. **Criar view segura** para marketplace cross-org sem PII

### Longo Prazo (1-3 meses)

11. **Implementar auditoria de auth events** (login/logout/reset/failed)
12. **Avaliar MFA** para roles admin/developer
13. **Migrar tokens OAuth** para Supabase Vault quando disponível
14. **Implementar Content Security Policy** headers
15. **Criar test suite de segurança** automatizada

---

## 5. ROADMAP DE SEGURANÇA

### Fase 1 — Correções Críticas (Semana 1)
- [ ] Fix marketplace_properties PII exposure
- [ ] Fix ai_usage_logs INSERT policy
- [ ] Enable leaked password protection
- [ ] Fix verification_codes anon INSERT

### Fase 2 — Hardening de Acesso (Semanas 2-3)
- [ ] Restringir imobzi_api_keys a gestores
- [ ] Adicionar role check a DELETE policies (properties, appointments)
- [ ] Proteger profile UPDATE contra org_id change
- [ ] Implementar hierarquia no UPDATE de user_roles
- [ ] Restringir imobzi_settings a gestores

### Fase 3 — Infraestrutura de Segurança (Semanas 4-6)
- [ ] Rate limiting em Edge Functions críticas
- [ ] CORS allowlist em todas as functions
- [ ] Auditoria de eventos de autenticação
- [ ] Review de todas 35 functions com verify_jwt = false

### Fase 4 — Maturidade (Meses 2-3)
- [ ] MFA para admin/developer
- [ ] Test suite de segurança automatizada
- [ ] Penetration test externo
- [ ] Programa de revisão de segurança trimestral

---

## 6. CHECKLIST FINAL DE VERIFICAÇÃO

### Banco de Dados
- [x] RLS habilitado em todas as tabelas
- [x] Filtro por organization_id em todas as policies
- [x] Functions SECURITY DEFINER com search_path fixo
- [ ] Nenhuma policy com WITH CHECK: true em operações sensíveis
- [ ] PII não exposta cross-tenant
- [ ] Tokens/credenciais criptografados

### Edge Functions
- [x] Validação de JWT na maioria das functions
- [x] Verificação de role em operações administrativas
- [x] Webhook com autenticação e idempotência
- [ ] Rate limiting implementado
- [ ] CORS restritivo em todas

### Frontend
- [x] Route guards para rotas admin
- [x] PII masking no analytics
- [x] Consent-gated tracking
- [x] Hierarquia de roles no client

### Autenticação
- [x] Email/senha com verificação
- [x] Convites com binding de email
- [ ] Leaked password protection
- [ ] MFA disponível
- [ ] Eventos de auth auditados

### LGPD
- [x] Consentimento explícito para cookies
- [x] Mascaramento de PII em gravações
- [x] Dados pessoais com acesso restrito (ad_leads)
- [ ] Processo de deleção/anonimização de dados
- [ ] Política de retenção implementada

---

## 7. TESTES DE SEGURANÇA RECOMENDADOS

### Testes Manuais
1. Tentar acessar marketplace_properties PII como usuário de outra org
2. Tentar inserir ai_usage_logs com user_id de outro usuário
3. Tentar criar verification_code como anônimo
4. Tentar ler imobzi_api_keys como corretor
5. Tentar deletar property como assistente
6. Tentar alterar organization_id via API direta no profile
7. Tentar alterar role de admin como leader
8. Tentar acessar Edge Function sem Bearer token
9. Tentar brute force no send-reset-email
10. Tentar IDOR em leads/contracts com IDs de outra org

### Testes Automatizados
1. Script que tenta CRUD em todas as tabelas com diferentes roles
2. Script que verifica isolamento multi-tenant com 2 orgs
3. Script que tenta bypass de RLS em todas as tabelas
4. Script que verifica se Edge Functions retornam 401/403 sem auth

---

*Relatório gerado por análise automatizada do schema (84 tabelas, 259 policies, 60+ Edge Functions) combinada com revisão manual de código das functions críticas.*

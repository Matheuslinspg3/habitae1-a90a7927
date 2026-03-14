# 🔴 Relatório Red Team Defensivo — Habitae ERP Imobiliário

**Data:** 2026-03-14  
**Tipo:** Simulação Red Team autorizada (defensiva)  
**Escopo:** 84 tabelas, 259 policies RLS, 60+ Edge Functions, Frontend React/TypeScript  
**Classificação:** CONFIDENCIAL  

---

## 1. RESUMO EXECUTIVO

### Score de Risco: 6.8/10 (ATENÇÃO MODERADA)

O sistema apresenta uma postura de segurança acima da média para SaaS B2B em Supabase, com RLS habilitado em todas as tabelas, RBAC implementado corretamente e auditoria avançada. No entanto, a análise red team identificou **3 vulnerabilidades críticas**, **8 altas** e **12 médias** que um atacante motivado poderia explorar.

**Destaques positivos:**
- ✅ Isolamento multi-tenant robusto via `is_member_of_org()` + `get_user_organization_id()`
- ✅ Anti-escalação de privilégio na criação de roles (bloqueia `developer`)
- ✅ Billing webhook com HMAC + idempotência + payload sanitizado
- ✅ Auditoria avançada com 27 campos + triggers automáticos + diffs JSONB
- ✅ LGPD compliance com consent-gated analytics (Clarity)
- ✅ Edge Functions administrativas com verificação de role server-side

**Vetores de ataque principais:**
- 🔴 `export-database` sem verificação de auth → dump completo do banco
- 🔴 PII de proprietários exposta cross-org no marketplace
- 🔴 `toggle-maintenance-mode` deactivate sem auth → DoS reverso
- 🟠 6+ Edge Functions vazam detalhes de erro internos ao client
- 🟠 Ausência total de rate limiting em todas as Edge Functions
- 🟠 CORS `*` wildcard em 90%+ das Edge Functions

---

## 2. MAPA DA SUPERFÍCIE DE ATAQUE

### 2.1 Endpoints Expostos (sem JWT automático)

| Superfície | verify_jwt | Auth Manual | Risco |
|------------|-----------|-------------|-------|
| `export-database` | ❌ false | ⚠️ Aceita qualquer header, NÃO valida token | 🔴 CRÍTICO |
| `toggle-maintenance-mode` | ❌ false | ⚠️ Permite deactivate sem auth | 🔴 ALTO |
| `platform-signup` | ❌ false | ⚠️ Sem auth (intencional) | 🟡 MÉDIO |
| `send-reset-email` | ❌ false | ❌ Sem auth (intencional) | 🟡 MÉDIO |
| `admin-users` | ❌ false | ✅ Verifica developer role | ✅ OK |
| `manage-member` | ❌ false | ✅ Verifica admin+ role | ✅ OK |
| `accept-invite` | ❌ false | ✅ Verifica JWT manual | ✅ OK |
| `billing-webhook` | ❌ false | ✅ Token HMAC + idempotência | ✅ OK |
| `rd-station-webhook` | ❌ false | ⚠️ Webhook (a verificar) | 🟡 MÉDIO |
| `meta-oauth-callback` | ❌ false | ⚠️ Callback OAuth | 🟡 MÉDIO |
| `send-push` | ❌ false | ⚠️ Chamado por trigger | 🟡 MÉDIO |

### 2.2 Dados Sensíveis Acessíveis

| Dado | Onde | Quem acessa | Risco |
|------|------|-------------|-------|
| OAuth tokens (Meta/RD Station) | `ad_accounts.auth_payload`, `rd_station_settings` | Membros da org (RLS) | 🟠 ALTO |
| API keys Imobzi | `imobzi_api_keys.api_key` | Todos os membros da org | 🟠 ALTO |
| PII proprietários | `marketplace_properties` | Qualquer autenticado | 🔴 CRÍTICO |
| Emails de leads | `leads.email` | Corretor do lead + gestores | ✅ OK |
| PII ad_leads | `ad_leads` | Gestores (is_org_manager_or_above) | ✅ OK |
| auth.users dump | `export-database` | Sem validação efetiva | 🔴 CRÍTICO |

---

## 3. VULNERABILIDADES POR SEVERIDADE

---

### 🔴 C1: `export-database` — Dump Completo Sem Autenticação Efetiva

**Descrição:** A Edge Function `export-database` recebe um `Authorization` header mas **NUNCA o valida**. Aceita qualquer string como header e prossegue com `service_role` para exportar TODAS as 78 tabelas + `auth.users` completo.

**Cenário de abuso:**
```bash
curl -H "Authorization: Bearer fake-token" \
  -H "Content-Type: application/json" \
  https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/export-database
```

**Ativos afetados:**
- Todos os dados de todas as organizações
- auth.users completo (emails, metadata, app_metadata)
- Chaves de API, tokens OAuth, configurações
- Leads, contratos, financeiro, comissões
- Schema DDL completo (enums, functions, triggers, policies)

**Severidade:** CRÍTICA  
**Probabilidade:** ALTA (endpoint público, sem proteção)  
**Impacto:** CATASTRÓFICO — vazamento total do banco multi-tenant  

**Como detectar:** Monitorar logs da Edge Function `export-database`. Qualquer chamada não autorizada é um incidente.

**Correção URGENTE:**
```typescript
// Adicionar no início da função, após authHeader check:
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const userClient = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authHeader } },
});
const token = authHeader.replace("Bearer ", "");
const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
if (claimsError || !claimsData?.claims) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
const callerId = claimsData.claims.sub as string;

// Verificar developer role
const adminClient = createClient(supabaseUrl, serviceKey);
const { data: devRole } = await adminClient
  .from("user_roles")
  .select("role")
  .eq("user_id", callerId)
  .eq("role", "developer")
  .maybeSingle();

if (!devRole) {
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Adicionar audit log
await adminClient.from("audit_events").insert({
  user_id: callerId,
  action: 'database.exported',
  action_category: 'export',
  entity_type: 'database',
  module: 'admin',
  risk_level: 'critical',
  source: 'edge_function',
});
```

**Prioridade:** P0 — Corrigir IMEDIATAMENTE  

---

### 🔴 C2: PII de Proprietários Exposta Cross-Org

**Descrição:** A tabela `marketplace_properties` expõe `owner_name`, `owner_phone`, `owner_email` e `commission_percentage` para qualquer usuário autenticado de qualquer organização quando `status = 'disponivel'`.

**Cenário de abuso:**
1. Corretor cria conta na Org B
2. Executa `SELECT owner_name, owner_phone, owner_email FROM marketplace_properties WHERE status = 'disponivel'`
3. Obtém dados de contato direto de proprietários de Org A
4. Contata proprietários diretamente, bypassing a imobiliária

**Severidade:** CRÍTICA  
**Probabilidade:** ALTA  
**Impacto:** Violação LGPD + perda de negócios + vazamento de dados comerciais sensíveis  

**Correção:**
```sql
-- Criar view segura para cross-org (sem PII)
CREATE OR REPLACE VIEW marketplace_properties_safe AS
SELECT id, title, description, property_type_id, transaction_type,
       sale_price, rent_price, bedrooms, suites, bathrooms, parking_spots,
       area_total, area_built, status, is_featured, images, amenities,
       address_neighborhood, address_city, address_state,
       organization_id, created_at, updated_at
FROM marketplace_properties
WHERE status = 'disponivel';

-- Restringir policy original para same-org only
DROP POLICY IF EXISTS "Authenticated users can view available marketplace properties" ON marketplace_properties;
CREATE POLICY "Org members can view own marketplace properties"
ON marketplace_properties FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id());
```

---

### 🔴 C3: `toggle-maintenance-mode` — Deativação Sem Autenticação

**Descrição:** A função `toggle-maintenance-mode` permite `action: "deactivate"` sem autenticação válida (linhas 98-104). A lógica é: "se não tem userId e action não é deactivate, bloqueia" — isso significa que deactivate passa sem auth.

**Cenário de abuso:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"deactivate"}' \
  https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/toggle-maintenance-mode
```

Um atacante pode desativar a manutenção a qualquer momento, potencialmente interferindo com operações de manutenção planejadas ou forçando o sistema a voltar ao ar antes de correções serem aplicadas.

**Severidade:** ALTA  
**Probabilidade:** MÉDIA  
**Impacto:** Interferência operacional, possível exposição durante janela de manutenção  

**Correção:** Exigir autenticação para AMBAS as ações:
```typescript
if (!userId) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

---

### 🟠 A1: Vazamento de Detalhes de Erro em 6+ Edge Functions

**Descrição:** Múltiplas Edge Functions vazam erros internos para o client:

| Function | Linha | O que vaza |
|----------|-------|-----------|
| `send-reset-email` | 132 | `details: resendData` — raw Resend API error |
| `send-invite-email` | 184 | `details: resendData` — raw Resend API error |
| `send-reset-email` | 144 | `err.message` — stack trace parcial |
| `send-invite-email` | 195 | `err.message` — stack trace parcial |
| `manage-member` | 220 | `msg` — erro interno completo |
| `toggle-maintenance-mode` | 202 | `message` — erro completo |

**Cenário de abuso:** Atacante envia requests malformados para extrair informações sobre infraestrutura interna (versões de API, configurações de provedor, estrutura de código).

**Severidade:** ALTA  
**Probabilidade:** ALTA  
**Impacto:** Information disclosure, facilita outros ataques  

**Correção padrão:**
```typescript
// Em vez de:
return new Response(JSON.stringify({ error: err.message }), ...);

// Usar:
console.error("[function-name] Error:", err);
return new Response(JSON.stringify({ error: "Erro interno" }), ...);
```

---

### 🟠 A2: CORS Wildcard em 90%+ das Edge Functions

**Descrição:** Apenas `admin-users` implementa allowlist de origens. Todas as outras Edge Functions usam `Access-Control-Allow-Origin: *`.

**Cenário de abuso:**
1. Atacante cria site malicioso
2. Vítima autenticada visita o site
3. JavaScript do site malicioso faz requests cross-origin usando o cookie/token da vítima
4. Dados são exfiltrados para o servidor do atacante

**Severidade:** ALTA  
**Probabilidade:** MÉDIA  
**Impacto:** CSRF-like attacks, exfiltração de dados  

**Correção:** Criar helper CORS compartilhado:
```typescript
// supabase/functions/_shared/cors.ts
const ALLOWED_ORIGINS = [
  "https://portadocorretor.com.br",
  "https://habitae1.lovable.app",
  "http://localhost:5173",
];

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}
```

---

### 🟠 A3: Ausência Total de Rate Limiting

**Descrição:** Nenhuma Edge Function implementa rate limiting. Endpoints públicos como `send-reset-email`, `platform-signup` e `send-invite-email` são alvos de abuso.

**Cenários de abuso:**
1. **Brute force em reset de senha:** Atacante envia milhares de requests para `send-reset-email` para gerar links de reset e descobrir emails existentes (timing attack)
2. **Spam de convites:** Atacante cria milhares de convites de plataforma
3. **Abuse de AI endpoints:** Atacante faz requests em massa para `generate-ad-content`, `summarize-lead`, etc., gerando custos

**Severidade:** ALTA  
**Probabilidade:** ALTA  
**Impacto:** Custos financeiros, spam, degradação de serviço  

**Correção — Rate limiter via banco:**
```sql
CREATE TABLE public.rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT, p_window_seconds INT DEFAULT 3600, p_max_requests INT DEFAULT 10
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INT;
BEGIN
  v_window_start := date_trunc('hour', now());
  
  INSERT INTO rate_limits (key, window_start, count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO v_count;
  
  RETURN v_count <= p_max_requests;
END;
$$;
```

```typescript
// Em edge functions:
const { data: allowed } = await adminClient.rpc('check_rate_limit', {
  p_key: `reset_${email}`,
  p_window_seconds: 3600,
  p_max_requests: 5,
});
if (!allowed) {
  return new Response(JSON.stringify({ error: "Muitas tentativas" }), { status: 429 });
}
```

---

### 🟠 A4: `manage-member` Vaza Erros Internos

**Descrição:** Ao contrário de `admin-users` que sanitiza erros, `manage-member` retorna `msg` diretamente ao client (linha 220), expondo mensagens internas como nomes de tabelas, constraint names, etc.

**Correção:**
```typescript
// Linha 220 — substituir:
return new Response(JSON.stringify({ error: msg }), ...);

// Por:
const safeMsg = msg.includes("Forbidden") ? "Sem permissão"
  : msg.includes("Unauthorized") ? "Não autenticado"
  : "Erro interno";
console.error("[manage-member]", msg);
return new Response(JSON.stringify({ error: safeMsg }), ...);
```

---

### 🟠 A5: `send-push` Sem Autenticação — Abuso de Notificações

**Descrição:** `send-push` tem `verify_jwt = false` e é chamado por trigger SQL com `net.http_post` usando a anon key. Porém, como não valida o caller, qualquer pessoa pode enviar push notifications para qualquer `user_id`.

**Cenário de abuso:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "apikey: <ANON_KEY>" \
  -d '{"user_id":"<victim_id>","title":"URGENTE","message":"Sua conta foi comprometida, acesse: evil.com"}' \
  https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/send-push
```

**Severidade:** ALTA  
**Probabilidade:** MÉDIA (requer conhecer user_id, que é UUID)  
**Impacto:** Phishing via push notification, engenharia social  

**Correção:** Adicionar validação de origem (trigger-only):
```typescript
// Verificar que a chamada vem do trigger (anon key + sem Bearer token real)
// Ou melhor: adicionar um shared secret entre trigger e function
const internalSecret = Deno.env.get("INTERNAL_TRIGGER_SECRET");
const receivedSecret = req.headers.get("x-internal-secret");
if (receivedSecret !== internalSecret) {
  return new Response("Unauthorized", { status: 401 });
}
```

---

### 🟠 A6: Imobzi API Keys Acessíveis por Todos os Membros

**Descrição:** RLS em `imobzi_api_keys` permite SELECT/INSERT/DELETE para qualquer membro da organização, incluindo corretores e assistentes que não precisam acessar chaves de API.

**Correção:** Restringir a gestores (admin, sub_admin, leader, developer).

---

### 🟠 A7: Verificação Incompleta de Hierarquia no UPDATE de `user_roles`

**Descrição:** A policy `Dev or leader can update roles` permite que um leader altere o role de um admin para corretor. Não há verificação de que o caller tem hierarquia superior ao target.

**Correção:**
```sql
CREATE OR REPLACE FUNCTION can_manage_role(caller_id UUID, target_role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = caller_id AND role = 'developer') THEN true
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = caller_id AND role = 'admin') 
      AND target_role NOT IN ('developer', 'admin') THEN true
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = caller_id AND role = 'leader') 
      AND target_role NOT IN ('developer', 'admin', 'sub_admin', 'leader') THEN true
    ELSE false
  END;
$$;
```

---

### 🟠 A8: Profile UPDATE Permite Alterar `organization_id`

**Descrição:** A policy de UPDATE em `profiles` usa `USING (user_id = auth.uid())` sem WITH CHECK que impeça alterar `organization_id`. Um usuário poderia, via API direta, migrar-se para outra organização.

**Cenário de abuso:**
```javascript
await supabase.from('profiles')
  .update({ organization_id: 'other-org-uuid' })
  .eq('user_id', myUserId);
```

**Correção:**
```sql
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update own profile (safe)"
ON profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND organization_id IS NOT DISTINCT FROM (
    SELECT p.organization_id FROM profiles p WHERE p.user_id = auth.uid()
  )
);
```

---

### 🟡 M1-M12: Riscos Médios

| # | Risco | Impacto | Correção |
|---|-------|---------|----------|
| M1 | `ai_usage_logs` INSERT sem restrição de `user_id` | Falsificação de métricas | WITH CHECK `user_id = auth.uid()` |
| M2 | `verification_codes` INSERT por anônimos | Enumeração de emails | Restringir a authenticated |
| M3 | Corretor pode DELETE `properties` | Deleção indevida | Role check no DELETE |
| M4 | Corretor pode DELETE `appointments` | Deleção indevida | Role check ou `created_by = auth.uid()` |
| M5 | `imobzi_settings` acessível por todos | Exposição de config | Restringir a gestores |
| M6 | Storage bucket `property-images` público | Enumeração de imagens | Considerar signed URLs |
| M7 | Portal XML feed sem rate limiting | Scraping em massa | Rate limiting por token |
| M8 | Leaked Password Protection desabilitado | Senhas fracas | Habilitar na config |
| M9 | Extensões no schema `public` | Risco teórico | Mover para schema dedicado |
| M10 | Falta de auditoria de auth events | Sem detecção de brute force | Auth hooks |
| M11 | Falta de MFA | Takeover de conta | TOTP para admin/developer |
| M12 | `subscription_plans` público (preços) | Exposição de estratégia | Avaliar se intencional |

---

## 4. HIPÓTESES DE ATAQUE POR CAMADA

### 4.1 Atacante Externo Não Autenticado

| Vetor | Viabilidade | Impacto |
|-------|-------------|---------|
| Dump do banco via `export-database` sem auth | ✅ VIÁVEL | CATASTRÓFICO |
| Desativar manutenção via `toggle-maintenance-mode` | ✅ VIÁVEL | ALTO |
| Enviar push notifications via `send-push` | ✅ VIÁVEL | MÉDIO |
| Brute force em `send-reset-email` (sem rate limit) | ✅ VIÁVEL | MÉDIO |
| Spam de signup via `platform-signup` (sem rate limit) | ✅ VIÁVEL | MÉDIO |
| Enumeração de emails via timing em login | ⚠️ POSSÍVEL | BAIXO |

### 4.2 Atacante Autenticado (Corretor Malicioso)

| Vetor | Viabilidade | Impacto |
|-------|-------------|---------|
| Ler PII de proprietários de outras orgs | ✅ VIÁVEL | ALTO |
| Deletar imóveis da organização | ✅ VIÁVEL | ALTO |
| Deletar agendamentos de outros | ✅ VIÁVEL | MÉDIO |
| Alterar `organization_id` no próprio perfil | ✅ VIÁVEL | ALTO |
| Ler API keys do Imobzi | ✅ VIÁVEL | MÉDIO |
| Falsificar logs de uso de IA | ✅ VIÁVEL | BAIXO |

### 4.3 Atacante Autenticado (Leader Malicioso)

| Vetor | Viabilidade | Impacto |
|-------|-------------|---------|
| Rebaixar admin para corretor | ✅ VIÁVEL | ALTO |
| Auto-promover para admin | ⚠️ POSSÍVEL (policy permite UPDATE) | ALTO |

### 4.4 Atacante Interno (Admin de Outra Org)

| Vetor | Viabilidade | Impacto |
|-------|-------------|---------|
| Acessar dados de outra org via manipulação de org_id | ❌ BLOQUEADO (RLS) | N/A |
| Cross-org via marketplace PII | ✅ VIÁVEL | ALTO |
| Enumeração de UUIDs | ❌ BLOQUEADO (UUIDv4) | N/A |

---

## 5. QUICK WINS DE SEGURANÇA

Correções que podem ser aplicadas em **< 1 hora cada**:

| # | Ação | Esforço | Impacto |
|---|------|---------|---------|
| 1 | Adicionar auth check em `export-database` | 15 min | 🔴 CRÍTICO |
| 2 | Exigir auth para deactivate em `toggle-maintenance-mode` | 5 min | 🔴 ALTO |
| 3 | Remover `details: resendData` de `send-reset-email` e `send-invite-email` | 5 min | 🟠 ALTO |
| 4 | Sanitizar erros em `manage-member` | 5 min | 🟠 ALTO |
| 5 | Habilitar Leaked Password Protection | 2 min | 🟡 MÉDIO |
| 6 | Restringir `ai_usage_logs` INSERT | 5 min | 🟡 MÉDIO |
| 7 | Restringir DELETE de properties a gestores | 5 min | 🟡 MÉDIO |

---

## 6. PLANO DE REMEDIAÇÃO POR FASES

### Fase 0 — EMERGÊNCIA (Hoje)
- [ ] **P0:** Fix auth em `export-database` — dump completo sem auth
- [ ] **P0:** Fix auth em `toggle-maintenance-mode` deactivate
- [ ] **P0:** Remover info leak de `send-reset-email` e `send-invite-email`

### Fase 1 — Crítico (Semana 1)
- [ ] Fix marketplace PII exposure (view sem PII para cross-org)
- [ ] Sanitizar erros em `manage-member`
- [ ] Proteger `send-push` contra chamadas externas
- [ ] Habilitar Leaked Password Protection
- [ ] Fix `ai_usage_logs` INSERT policy

### Fase 2 — Alto (Semanas 2-3)
- [ ] Restringir `imobzi_api_keys` a gestores
- [ ] Proteger profile UPDATE contra `organization_id` change
- [ ] Adicionar hierarquia no UPDATE de `user_roles`
- [ ] Role check no DELETE de properties e appointments
- [ ] Implementar CORS allowlist shared para todas as functions
- [ ] Restringir `imobzi_settings` a gestores

### Fase 3 — Infraestrutura (Semanas 4-6)
- [ ] Implementar rate limiting em Edge Functions críticas
- [ ] Adicionar auditoria de auth events (login/logout/failed)
- [ ] Adicionar audit log no `export-database`
- [ ] Implementar token rotation para portal XML feeds
- [ ] Review de todas 35+ functions com verify_jwt = false

### Fase 4 — Maturidade (Meses 2-3)
- [ ] MFA para admin/developer
- [ ] Test suite de segurança automatizada (script de RBAC/tenant isolation)
- [ ] Penetration test externo profissional
- [ ] Security review trimestral

---

## 7. CHECKLIST FINAL DE HARDENING

### Edge Functions
- [ ] `export-database` valida JWT + developer role + audit log
- [ ] `toggle-maintenance-mode` exige auth para AMBAS ações
- [ ] `send-push` valida origem (internal trigger secret)
- [ ] Nenhuma function vaza `err.message` ou `details` para client
- [ ] CORS allowlist em todas as functions sensíveis
- [ ] Rate limiting em `send-reset-email`, `platform-signup`, `send-push`

### RLS Policies
- [ ] `marketplace_properties` — PII não acessível cross-org
- [ ] `ai_usage_logs` INSERT — `user_id = auth.uid()`
- [ ] `verification_codes` INSERT — apenas authenticated
- [ ] `properties` DELETE — role check (gestor+)
- [ ] `appointments` DELETE — role check ou `created_by`
- [ ] `profiles` UPDATE — `organization_id` imutável
- [ ] `user_roles` UPDATE — verificação de hierarquia
- [ ] `imobzi_api_keys` — restrito a gestores
- [ ] `imobzi_settings` — restrito a gestores

### Autenticação
- [ ] Leaked Password Protection habilitado
- [ ] Rate limiting em reset de senha
- [ ] Auditoria de auth events
- [ ] MFA disponível para admin/developer

### Monitoramento
- [ ] Alertas para chamadas ao `export-database`
- [ ] Alertas para mudanças de role
- [ ] Alertas para remoção de membro
- [ ] Alertas para tentativas de acesso negado (RLS violations)
- [ ] Alertas para volume anômalo de requests em Edge Functions

---

## 8. SUGESTÕES DE TESTES CONTÍNUOS

### Testes Manuais (Executar mensalmente)
1. Tentar chamar `export-database` sem token válido
2. Tentar `toggle-maintenance-mode` deactivate sem auth
3. Tentar `send-push` com user_id arbitrário
4. Tentar ler `marketplace_properties` PII como usuário de outra org
5. Tentar UPDATE de `organization_id` no profile via API direta
6. Tentar DELETE de property como corretor
7. Tentar UPDATE de role de admin como leader
8. Tentar ler `imobzi_api_keys` como assistente

### Testes Automatizados (CI/CD)
1. Script que tenta CRUD em todas as tabelas com cada role
2. Script que verifica isolamento multi-tenant entre 2 orgs
3. Script que chama todas Edge Functions sem auth e espera 401/403
4. Script que verifica que nenhuma response contém stack traces

### Métricas de Segurança
- % de Edge Functions com auth validada
- % de tabelas com DELETE restrito a gestores
- Tempo médio de resposta a vulnerabilidades reportadas
- Volume de tentativas de acesso negado por hora

---

*Relatório gerado por análise red team defensiva. Todas as vulnerabilidades descritas são baseadas em revisão de código, sem execução de exploits contra ambiente de produção. A remediação deve ser priorizada conforme o plano de fases apresentado.*

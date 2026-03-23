# Relatório de Auditoria de Segurança — Porta do Corretor

**Data:** 2026-03-23
**Escopo:** Warnings de segurança do linter (SECURITY DEFINER views + RLS permissiva)
**Migration de correção:** `supabase/migrations/20260323150000_security_fixes.sql`

---

## Resumo Executivo

Foram analisados **2 warnings** do linter de segurança. A auditoria encontrou **14 ocorrências** no total:
- **1 bug residual** corrigido nesta migration
- **7 bugs já corrigidos** em migrations anteriores
- **6 padrões intencionais** documentados

---

## Warning 1: Security Definer View sem Proteção Adequada

### 1.1 — `properties_public_landing` (view)

| Campo | Valor |
|---|---|
| **Classificação** | BUG |
| **Risco** | CRITICO |
| **Status** | CORRIGIDO (migration anterior: `20260214035018`) |

**Problema:** View criada em `20260214035006` sem `security_invoker`, fazendo-a rodar com permissões do superuser e ignorando RLS.

**Risco real:** Qualquer usuário (inclusive anon) conseguiria ver TODOS os imóveis sem restrição de RLS, incluindo propriedades não-disponíveis e dados que deveriam estar ocultos.

**Correção aplicada:** Migration `20260214035018` recria a view com `security_invoker = true`, garantindo que as queries da view respeitem as políticas RLS do usuário que a consulta.

---

## Warning 2: RLS Policy Permissiva — USING (true) / WITH CHECK (true)

### 2.1 — `marketplace_properties` SELECT cross-org (base table)

| Campo | Valor |
|---|---|
| **Classificação** | BUG |
| **Risco** | MEDIO |
| **Status** | CORRIGIDO (nesta migration: `20260323150000`) |

**Problema:** Policy `"Authenticated users can view available marketplace properties (no PII)"` (migration `20260314050038`) permitia SELECT cross-org no base table, expondo `owner_name`, `owner_phone` e `owner_email` para qualquer usuário autenticado que consultasse a tabela diretamente (e não a view).

**Risco real:** Usuário autenticado de outra organização conseguiria obter dados PII de proprietários via query direta ao base table usando o Supabase client SDK, mesmo que o frontend use a view segura.

**Correção:** Removida policy cross-org no base table. Membros da org veem apenas seus próprios imóveis. Acesso cross-org deve obrigatoriamente usar a view `marketplace_properties_public` (que omite campos PII). Revogado SELECT do role `anon`.

---

### 2.2 — `marketplace_properties` INSERT/UPDATE/DELETE WITH CHECK(true)

| Campo | Valor |
|---|---|
| **Classificação** | BUG |
| **Risco** | CRITICO |
| **Status** | CORRIGIDO (migration anterior: `20260207214931`) |

**Problema:** Policies em `20260207043312` permitiam qualquer autenticado inserir, atualizar e deletar imóveis de QUALQUER organização no marketplace.

**Risco real:** Um corretor poderia deletar imóveis de outras imobiliárias ou publicar imóveis falsos em nome de outra organização.

---

### 2.3 — `notifications` INSERT WITH CHECK(true)

| Campo | Valor |
|---|---|
| **Classificação** | BUG |
| **Risco** | MEDIO |
| **Status** | CORRIGIDO (migration anterior: `20260211031207`) |

**Problema:** Qualquer pessoa poderia inserir notificações para qualquer usuário.

**Risco real:** Phishing interno — um usuário malicioso poderia criar notificações falsas para outros usuários com links ou mensagens enganosas.

---

### 2.4 — `property_landing_overrides` SELECT USING(true)

| Campo | Valor |
|---|---|
| **Classificação** | BUG |
| **Risco** | BAIXO |
| **Status** | CORRIGIDO (migration anterior: `20260314045728`) |

**Problema:** Personalizações de landing page visíveis para qualquer pessoa.

**Risco real:** Baixo — dados de customização visual, sem PII. Mas expunha estratégia de marketing da organização.

---

### 2.5 — `organizations` SELECT USING(true)

| Campo | Valor |
|---|---|
| **Classificação** | BUG |
| **Risco** | MEDIO |
| **Status** | CORRIGIDO (migration anterior: `20260216051656`) |

**Problema:** Todos os dados de todas as organizações expostos publicamente (incluindo phone, email, configurações internas).

**Risco real:** Enumeração de organizações, scraping de dados de contato comercial, informações de configuração interna.

---

### 2.6 — `scrape_cache` INSERT/UPDATE para authenticated

| Campo | Valor |
|---|---|
| **Classificação** | BUG |
| **Risco** | MEDIO |
| **Status** | CORRIGIDO (migrations anteriores: `20260202050942` + `20260314045728`) |

**Problema:** Clientes autenticados podiam manipular o cache de scraping.

**Risco real:** Cache poisoning — um usuário poderia corromper dados de scraping, fazendo o sistema importar dados falsos para imóveis.

---

### 2.7 — `billing_webhook_logs` INSERT WITH CHECK(true)

| Campo | Valor |
|---|---|
| **Classificação** | BUG |
| **Risco** | CRITICO |
| **Status** | CORRIGIDO (migration anterior: `20260217042254`) |

**Problema:** Qualquer pessoa (incluindo anon) poderia inserir logs falsos de webhook de billing.

**Risco real:** Injeção de eventos de pagamento falsos, potencialmente ativando funcionalidades pagas sem pagamento real.

---

### 2.8 — `ai_usage_logs` INSERT WITH CHECK(true)

| Campo | Valor |
|---|---|
| **Classificação** | BUG |
| **Risco** | BAIXO |
| **Status** | CORRIGIDO (migration anterior: `20260314194017`) |

**Problema:** Usuário poderia inserir logs com user_id ou organization_id de outra pessoa/org.

**Risco real:** Inflar métricas de uso de IA de outras organizações, potencialmente afetando billing.

---

### 2.9 — `verification_codes` INSERT WITH CHECK(true)

| Campo | Valor |
|---|---|
| **Classificação** | BUG |
| **Risco** | BAIXO |
| **Status** | CORRIGIDO (migration anterior: `20260314194017`) |

**Problema:** Criação irrestrita de códigos de verificação.

**Risco real:** DoS por preenchimento da tabela com códigos falsos.

---

### 2.10 — `property_landing_content` SELECT USING(true)

| Campo | Valor |
|---|---|
| **Classificação** | INTENCIONAL |
| **Risco** | BAIXO |
| **Status** | DOCUMENTADO |

**Motivo:** Landing pages de imóveis são públicas por design. A tabela contém apenas conteúdo de apresentação (textos, headlines) sem dados sensíveis. Necessário para visitantes anônimos acessarem as landing pages.

---

### 2.11 — `property_type_codes` SELECT USING(true)

| Campo | Valor |
|---|---|
| **Classificação** | INTENCIONAL |
| **Risco** | BAIXO |
| **Status** | DOCUMENTADO |

**Motivo:** Dados de referência globais (tipos de imóvel: casa, apto, terreno, etc). Tabela somente leitura sem dados sensíveis.

---

### 2.12 — `app_runtime_config` SELECT USING(true) TO anon,authenticated

| Campo | Valor |
|---|---|
| **Classificação** | INTENCIONAL |
| **Risco** | BAIXO |
| **Status** | DOCUMENTADO |

**Motivo:** Configuração pública do app (feature flags, versão mínima do app, etc). Somente SELECT permitido; INSERT/UPDATE/DELETE restritos a service_role.

---

### 2.13 — `ai_billing_pricing` SELECT USING(true) TO authenticated

| Campo | Valor |
|---|---|
| **Classificação** | INTENCIONAL |
| **Risco** | BAIXO |
| **Status** | DOCUMENTADO |

**Motivo:** Dados de precificação visíveis a todos os usuários autenticados para transparência. Gerenciamento restrito ao role `developer`.

---

### 2.14 — `deleted_property_media` / `scrape_cache` ALL USING(true) TO service_role

| Campo | Valor |
|---|---|
| **Classificação** | INTENCIONAL |
| **Risco** | BAIXO |
| **Status** | DOCUMENTADO |

**Motivo:** Tabelas internas acessíveis apenas por `service_role` (cron jobs, edge functions). O `service_role` já bypassa RLS por padrão no Supabase, então a policy é tecnicamente redundante mas explícita.

---

## Resumo por Status

| Status | Quantidade |
|---|---|
| CORRIGIDO (nesta migration) | 1 |
| CORRIGIDO (migrations anteriores) | 7 |
| DOCUMENTADO (intencional) | 6 |
| **Total** | **14** |

## Resumo por Risco

| Risco | Quantidade |
|---|---|
| CRITICO | 3 |
| MEDIO | 4 |
| BAIXO | 7 |
| **Total** | **14** |

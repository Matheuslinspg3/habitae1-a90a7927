# 📋 Changelog — Porta do Corretor v3.3.0

**Período:** 13 a 14 de março de 2026  
**Versão anterior:** 3.2.0.6  
**Versão atual:** 3.3.0

---

## 📌 RESUMO EXECUTIVO

Esta release consolida uma série de melhorias em 4 frentes: **UX/Navegação**, **Segurança**, **Infraestrutura de IA** e **Qualidade de Dados**. Foram criados/editados ~30 arquivos, 2 migrações SQL, 4 documentos técnicos e 1 novo componente no Painel Developer.

---

## 🚀 FUNCIONALIDADES IMPLEMENTADAS

### 1. Busca Global (Command Palette — Cmd+K)
- **O que faz:** Barra de busca universal acessível via `Ctrl+K` / `Cmd+K` ou clicando no ícone de busca no sidebar
- **Busca em:** Imóveis (título, código, bairro), Leads (nome, email, telefone), Contratos (código)
- **Resultado:** Navegação instantânea ao clicar no resultado
- **Analytics:** Eventos rastreados: `command_palette_shortcut`, `cmd_navigate_property`, `cmd_navigate_lead`, `cmd_navigate_contract`, `cmd_search_success`
- **Arquivos:** `src/components/command-palette/` (novo diretório)

### 2. Dashboard de Auditoria de Segurança (Painel Developer)
- **O que faz:** Card interativo na aba "IA" do Painel Developer com:
  - **Aba Resumo:** Score de risco (7.2/10), contagem por severidade (3 Críticas, 8 Altas, 10 Médias), progresso geral de remediação
  - **Aba Findings:** Lista detalhada de 21 vulnerabilidades com descrição, impacto, correção sugerida e nível de esforço
  - **Aba Checklist:** Roadmap de 5 fases com checkboxes interativos para acompanhar progresso
- **Arquivo:** `src/components/developer/SecurityAuditCard.tsx`

### 3. Correção de Leads Duplicados (RD Station)
- **Problema:** Race condition no webhook do RD Station causava duplicação de leads (ex: Aretuza Machado, Kelly)
- **Correção banco:** Índices únicos parciais criados:
  - `idx_leads_unique_email_per_org` — impede dois leads ativos com mesmo email na mesma org
  - `idx_leads_unique_external_id_per_org` — impede duplicatas por ID externo
- **Correção código:** Webhook agora captura erro Postgres `23505` (unique violation) e trata como duplicata sem falhar
- **Limpeza:** Soft-delete (`is_active = false`) das duplicatas identificadas
- **Arquivos:** `supabase/functions/rd-station-webhook/index.ts`, migração SQL

---

## 🔒 AUDITORIAS DE SEGURANÇA

### Auditoria Completa (Security Audit)
- **Escopo:** 84 tabelas, 259 políticas RLS, 60+ Edge Functions
- **Score:** 7.2/10 (BOM, com pontos de atenção)
- **Documento:** `docs/SECURITY_AUDIT_2026-03-14.md`
- **Findings principais:**
  - 🔴 C1: PII de proprietários exposta no marketplace cross-org
  - 🔴 C2: `ai_usage_logs` INSERT sem restrição de user_id/org
  - 🟠 A1-A5: Verification codes anônimos, API keys acessíveis, OAuth em texto plano, leaked password protection desabilitada, 35+ functions com `verify_jwt = false`
  - 🟡 M1-M7: Corretor pode atribuir leads a outros, DELETE sem role check, falta rate limiting, CORS wildcard

### Red Team Defensivo
- **Score:** 6.8/10 (ATENÇÃO MODERADA)
- **Documento:** `docs/RED_TEAM_AUDIT_2026-03-14.md`
- **Vetores críticos identificados:**
  - 🔴 `export-database` sem verificação de auth efetiva
  - 🔴 `toggle-maintenance-mode` deactivate sem auth
  - 🔴 PII no marketplace cross-org
  - 🟠 Info leak em 6+ Edge Functions

### Documentação Técnica Atualizada
- `docs/PROMPT_CONTEXTO_PROJETO.md` — Blueprint técnico completo atualizado
- `docs/MAPA_FUNCIONALIDADES.md` — Mapa de todos os 17 módulos atualizado
- `docs/ESTRUTURA_DADOS.md` — Arquitetura de dados consolidada

---

## ⚙️ O QUE VOCÊ PRECISA CONFIGURAR / AÇÕES MANUAIS

### 🔴 URGENTE (Fazer esta semana)

| # | Ação | Como fazer | Onde |
|---|------|-----------|------|
| 1 | **Habilitar Leaked Password Protection** | Nas configurações de autenticação do projeto, ativar verificação de senhas vazadas | Lovable Cloud → Auth Settings |
| 2 | **Corrigir policy `ai_usage_logs`** | Executar SQL para restringir INSERT a `user_id = auth.uid()` | Migration SQL (ver abaixo) |
| 3 | **Corrigir PII no marketplace** | Criar VIEW sem dados pessoais para acesso cross-org | Migration SQL (ver abaixo) |
| 4 | **Corrigir `verification_codes`** | Remover branch que permite anônimos criar códigos | Migration SQL (ver abaixo) |
| 5 | **Fixar auth no `export-database`** | Validar JWT real + verificar role `developer` | Edge Function já documentada |
| 6 | **Fixar auth no `toggle-maintenance-mode`** | Exigir auth para deactivate | Edge Function já documentada |

### 🟠 IMPORTANTE (Fazer em 2 semanas)

| # | Ação | Descrição |
|---|------|-----------|
| 7 | **Restringir `imobzi_api_keys`** a gestores | DROP + CREATE policy com `is_org_manager_or_above()` |
| 8 | **Adicionar role check ao DELETE** de `properties` e `appointments` | Apenas gestores podem deletar |
| 9 | **Proteger profile UPDATE** | Impedir alteração de `organization_id` via API direta |
| 10 | **Verificação de hierarquia em `user_roles` UPDATE** | Impedir leader de alterar role de admin |
| 11 | **Restringir `imobzi_settings`** a gestores | Mesma abordagem do item 7 |

### 🟡 MÉDIO PRAZO (1 mês)

| # | Ação | Descrição |
|---|------|-----------|
| 12 | **Rate limiting** em `send-reset-email`, `platform-signup`, `accept-invite` | Implementar via tabela de contagem |
| 13 | **CORS allowlist** em todas Edge Functions sensíveis | Expandir padrão do `admin-users` |
| 14 | **Auditoria de auth events** | Rastrear login/logout/reset/falhas |
| 15 | **Avaliar MFA** para admin/developer | TOTP via Supabase Auth |

---

## 📝 SQLs PENDENTES PARA EXECUTAR

### SQL 1: Corrigir `ai_usage_logs` INSERT
```sql
DROP POLICY "Authenticated users can insert ai_usage_logs" ON ai_usage_logs;

CREATE POLICY "Users can insert own ai_usage_logs"
ON ai_usage_logs FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (organization_id IS NULL OR organization_id = get_user_organization_id())
);
```

### SQL 2: Corrigir `verification_codes` INSERT
```sql
DROP POLICY "Users can create verification codes" ON verification_codes;

CREATE POLICY "Authenticated users can create verification codes"
ON verification_codes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
```

### SQL 3: Restringir `imobzi_api_keys` a gestores
```sql
DROP POLICY IF EXISTS "Org members can view API keys" ON imobzi_api_keys;
CREATE POLICY "Managers can view API keys"
ON imobzi_api_keys FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND is_org_manager_or_above(auth.uid())
);

DROP POLICY IF EXISTS "Org members can insert API keys" ON imobzi_api_keys;
CREATE POLICY "Managers can insert API keys"
ON imobzi_api_keys FOR INSERT TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id()
  AND is_org_manager_or_above(auth.uid())
);

DROP POLICY IF EXISTS "Org members can delete API keys" ON imobzi_api_keys;
CREATE POLICY "Managers can delete API keys"
ON imobzi_api_keys FOR DELETE TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND is_org_manager_or_above(auth.uid())
);
```

### SQL 4: Role check no DELETE de `properties`
```sql
DROP POLICY "Users can delete properties in their organization" ON properties;
CREATE POLICY "Managers can delete properties"
ON properties FOR DELETE TO authenticated
USING (
  is_member_of_org(organization_id)
  AND is_org_manager_or_above(auth.uid())
);
```

### SQL 5: Proteger profile UPDATE
```sql
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

---

## 📊 MÉTRICAS DA RELEASE

| Métrica | Valor |
|---------|-------|
| Arquivos criados/editados | ~30 |
| Migrações SQL executadas | 2 |
| Documentos técnicos criados | 4 |
| Vulnerabilidades identificadas | 21 (3 críticas, 8 altas, 10 médias) |
| Leads duplicados corrigidos | 2 (soft-delete) |
| Índices de proteção criados | 2 (unique parcial) |
| Versão | 3.2.0.6 → 3.3.0 |

---

## 📁 ARQUIVOS CRIADOS/MODIFICADOS

### Novos
- `src/components/developer/SecurityAuditCard.tsx`
- `src/components/command-palette/` (diretório completo)
- `docs/SECURITY_AUDIT_2026-03-14.md`
- `docs/RED_TEAM_AUDIT_2026-03-14.md`
- `docs/PROMPT_CONTEXTO_PROJETO.md` (reescrito)
- `docs/MAPA_FUNCIONALIDADES.md` (reescrito)
- `supabase/migrations/20260314155721_*.sql` (dedup leads + índices)

### Modificados
- `src/pages/developer/DeveloperDashboard.tsx` (SecurityAuditCard integrado)
- `src/config/appVersion.ts` (3.2.0.6 → 3.3.0)
- `public/version.json` (3.2.0.6 → 3.3.0)
- `supabase/functions/rd-station-webhook/index.ts` (dedup handling)

---

*Documento gerado em 2026-03-14. Para detalhes completos de cada finding de segurança, consulte `docs/SECURITY_AUDIT_2026-03-14.md` e `docs/RED_TEAM_AUDIT_2026-03-14.md`.*

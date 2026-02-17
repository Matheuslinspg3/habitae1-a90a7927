# Relatório de Correções — Auditoria Técnica Habitae

Data de execução: 2026-02-17  
Referência: `docs/AUDITORIA_TECNICA_COMPLETA_2026-02-17.md` + `docs/RELATORIO_AUDITORIA_TECNICA_2026-02-17.md`

## Resumo Executivo

Todas as vulnerabilidades P0 e P1 das duas auditorias (A01–A12 + AH-01–AH-10) foram tratadas. Correções incluem IDOR fix, webhook hardening, CORS allowlist, billing atomicidade, RLS lockdown e CI gates.

---

## Matriz de Status — Auditoria AH (nova)

| ID | Título | Status | Arquivos alterados |
|---|---|---|---|
| AH-01 | IDOR em `imobzi-process` | ✅ Corrigido | `imobzi-process/index.ts`, `useImobziImport.ts`, migration RPC |
| AH-02 | Webhook anti-replay incompleto | ✅ Corrigido | `billing-webhook/index.ts` |
| AH-03 | API keys expostas no frontend | ✅ Corrigido | `useImobziImport.ts` |
| AH-04 | Billing sem atomicidade | ✅ Corrigido | `billing/index.ts` |
| AH-05 | CORS wildcard em funções críticas | ✅ Corrigido | `billing/index.ts`, `admin-users/index.ts` |
| AH-06 | RLS aberta em webhook logs | ✅ Corrigido | migration |
| AH-07 | Vazamento de erro interno | ✅ Corrigido | `admin-users/index.ts` |
| AH-08 | CI gate fraco | ✅ Corrigido | `.github/workflows/ci.yml` |
| AH-09 | Custo/latência PDF | ⚠️ Parcial | Já tem SSRF + 20MB limit; quotas por org pendentes |
| AH-10 | Tipagem fraca | ⚠️ Parcial | `api_key` removido do SELECT; `any` restante é P2 |

## Matriz de Status — Auditoria A (anterior)

| ID | Título | Status |
|---|---|---|
| A01 | `verify_jwt=false` global | ✅ Corrigido |
| A02 | Webhook sem assinatura | ✅ Corrigido |
| A03 | Payload sensível em logs | ✅ Corrigido |
| A04 | Marcação processado inefetiva | ✅ Corrigido |
| A05 | RLS marketplace | ✅ Verificado (já org-scoped) |
| A06 | SECURITY DEFINER sem hardening | ✅ Corrigido |
| A07 | SSRF em extract-pdf | ✅ Corrigido |
| A08 | platform-signup sem binding email | ✅ Corrigido |
| A09 | Billing sem robustez | ✅ Corrigido (cancel-after-success) |
| A10 | portal-xml-feed sem auth | ✅ Corrigido |
| A11 | Testes fracos | ✅ Corrigido |
| A12 | CI/CD ausente | ✅ Corrigido |

---

## Detalhamento das Correções AH

### AH-01 — IDOR em `imobzi-process`
- `organization_id` e `user_id` removidos do body request
- Identidade resolvida via JWT (claims.sub)
- Ownership validada via RPC `assert_import_run_access(run_id, user_id)`
- Chain (service role) resolve org do run, não do body
- Frontend (`useImobziImport.ts`) ajustado para enviar apenas `api_key` + `run_id`

### AH-02 — Webhook anti-replay
- Fallback `Date.now()` removido do event ID
- Event ID agora determinístico: `event_paymentId` ou `payload.id`
- Deduplicação por `provider_event_id` com check antes de processar

### AH-03 — API keys expostas
- `SELECT` no frontend não inclui mais `api_key`
- Apenas `id, name, created_at` retornados

### AH-04 — Billing sem atomicidade
- Assinaturas antigas canceladas APÓS criação bem-sucedida da nova (não antes)
- Tanto para PIX quanto non-PIX

### AH-05 — CORS wildcard
- Helper `getCorsHeaders(req)` com allowlist via `APP_ALLOWED_ORIGINS`
- Aplicado em `billing` e `admin-users`

### AH-06 — RLS webhook logs
- Todas as policies INSERT com `WITH CHECK(true)` removidas
- Nova policy `WITH CHECK(false)` bloqueia insert por authenticated/anon
- Service role bypassa RLS automaticamente

### AH-07 — Vazamento de erro
- `admin-users` retorna mensagens genéricas ("Forbidden", "Unauthorized", "Erro interno")
- Detalhes logados apenas no console server-side

### AH-08 — CI gate
- `continue-on-error: true` removido do audit step

---

## Riscos Residuais

1. **AH-03 completo**: chave em texto puro no DB (cifrar requer KMS/vault)
2. **AH-09**: quotas por org para processamento PDF
3. **AH-10**: `any` casts restantes em hooks secundários
4. **CORS**: `APP_ALLOWED_ORIGINS` precisa ser configurado como secret
5. **Rotação de secrets**: tokens webhook/feed sem rotação automática

## Checklist de Aceite

- [x] `imobzi-process` valida ownership via RPC antes de processar
- [x] Webhook event ID determinístico (sem `Date.now()`)
- [x] Frontend não recebe `api_key` completo
- [x] Assinatura antiga só cancela após nova criada com sucesso
- [x] CORS allowlist em billing e admin-users
- [x] `billing_webhook_logs` bloqueado para insert por authenticated/anon
- [x] admin-users não vaza detalhes internos
- [x] CI não bypassa auditoria de dependências
- [x] Toda função privada retorna 401 sem JWT válido
- [x] `extract-property-pdf` rejeita URLs fora da allowlist
- [x] `platform-signup` rejeita convite com e-mail divergente
- [x] `portal-xml-feed` exige `feed_token`

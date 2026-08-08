# Funções Edge públicas (`verify_jwt = false`): escopo, justificativa e controles

**Última revisão:** 2026-02-17  
**Owner:** Segurança de Aplicação / Plataforma

## 1) Inventário oficial

Atualmente, somente as funções abaixo operam com `verify_jwt = false`:

1. `platform-signup`
2. `admin-users`

> Fonte de verdade: `supabase/config.toml`.

## 2) Justificativa por função

### `platform-signup`

- **Por que precisa ser pública:** a criação de conta por convite ocorre antes de existir sessão autenticada no tenant.
- **Controles compensatórios exigidos:**
  - Validação estrita de convite ativo/expirado/usado.
  - Binding de `invite_email` com e-mail informado.
  - Rate limit por IP e por `invite_id`.
  - Honeypot para reduzir automação abusiva.
  - Allowlist de origem (`APP_ALLOWED_ORIGINS`) para reduzir abuso cross-site.
  - Log estruturado de tentativas para investigação.

### `admin-users`

- **Por que precisa ser pública:** o Gateway não exige JWT automaticamente quando `verify_jwt=false`, mas a função implementa **autenticação e autorização internas** por `Authorization` + claims + papel `developer`.
- **Controles compensatórios exigidos:**
  - Verificação obrigatória de `Authorization` bearer token.
  - Validação de claims com `auth.getClaims`.
  - Autorização por papel (`developer`) no banco.
  - Rate limit por usuário/método (GET e DELETE).
  - Respostas sanitizadas para evitar vazamento de detalhes internos.
  - Log estruturado de uso/erros para auditoria.

## 3) Política de segurança para novas exceções

Qualquer nova função com `verify_jwt = false` deve:

1. Ser aprovada em revisão de segurança.
2. Ter justificativa explícita neste documento.
3. Implementar autenticação/validação no código da função.
4. Implementar rate limiting e telemetria mínima.
5. Incluir teste de regressão cobrindo cenários de auth negativa.

Sem esses cinco itens, a exceção não deve ser aceita.

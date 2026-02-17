# Runbook: Autenticação

**Owner:** Auth / Frontend  
**Última revisão:** 2026-02-17

---

## Sintomas típicos

| Sintoma | Possível causa |
|---|---|
| Login retorna erro genérico | Supabase Auth indisponível ou rate limited |
| Sessão perdida após refresh | Token expirado e autoRefresh falhando |
| Convite não funciona | Token de convite expirado ou já usado |
| Tela de loading infinito | `ProtectedRoute` aguardando sessão que não resolve |
| CAPTCHA aparece no login | Volume de falhas acima do limite por sessão/IP |
| Login temporariamente bloqueado | Política de lockout acionada por abuso |

---

## Configuração operacional de anti-abuse

### Supabase Auth (dashboard)
Confirmar em **Authentication → Rate Limits**:
- `sign_in / password`: manter limite global habilitado.
- `token refresh`: manter limite padrão habilitado.
- `OTP / recovery`: manter limite padrão habilitado.

> Observação: os valores exatos podem variar por plano/ambiente, mas o controle precisa estar habilitado em produção.

### Controles adicionais da aplicação (Edge Function `auth-security`)
- **CAPTCHA adaptativo:**
  - por sessão: a partir de **3** falhas em janela de 15 min.
  - por IP: a partir de **5** falhas em janela de 15 min.
- **Lockout temporário:**
  - por sessão: a partir de **7** falhas em janela de 15 min.
  - por IP: a partir de **10** falhas em janela de 15 min.
  - duração do lockout: **15 min**.
- **Mensagem segura de erro:** sempre genérica, sem indicar se o e-mail existe.

---

## Diagnóstico rápido

1. **Console do navegador:** buscar erros de auth/network.
2. **Logs da função `auth-security`:** procurar `auth_anomaly_detected`.
3. **Tentativas de login registradas:**
   ```sql
   SELECT created_at, email, session_id, ip_address, success, reason
   FROM public.auth_login_attempts
   ORDER BY created_at DESC
   LIMIT 100;
   ```
4. **Visão agregada de anomalias (24h):**
   ```sql
   SELECT *
   FROM public.auth_login_anomalies
   ORDER BY minute_bucket DESC
   LIMIT 120;
   ```
5. **Verificar perfil do usuário:**
   ```sql
   SELECT * FROM profiles WHERE user_id = '<user_id>';
   ```

---

## Mitigações

### Rate limiting/CAPTCHA em alta
- Verificar picos de IP em `auth_login_attempts`.
- Se for tráfego malicioso, bloquear na borda (WAF/CDN) e manter lockout.

### Usuário legítimo bloqueado
- Orientar aguardar o fim do lockout (15 min).
- Não remover lockout manualmente sem evidência de falso positivo em massa.

### Sessão não persiste
- Verificar localStorage do navegador (storage cheio?).
- Limpar cookies/storage e re-logar.

---

## Alertas e escalonamento

| Condição | Ação |
|---|---|
| >10% dos logins falhando em 5 min | SEV-1 |
| `distinct_failed_ips` > 20 em 5 min | Abrir incidente de abuso |
| Lockout acionado em contas legítimas (falso positivo) | SEV-2 + ajuste de limiar |
| Supabase Auth degradado | Monitorar status do Supabase |

---

## Teste de carga controlada (tentativas inválidas)

1. Fazer deploy da função `auth-security` e aplicar migrations.
2. Rodar o script local:
   ```bash
   node scripts/auth-invalid-load-test.mjs
   ```
3. Validar resultado esperado:
   - aumento de `failedAttemptsSession`;
   - ativação de CAPTCHA após limiar;
   - lockout retornado após limiar;
   - evento `auth_anomaly_detected` nos logs.

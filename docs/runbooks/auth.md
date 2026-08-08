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

---

## Diagnóstico rápido

1. **Console do navegador:** buscar erros de auth/network.
2. **Logs de Auth no Cloud:**
   ```sql
   SELECT id, timestamp, event_message, metadata.status, metadata.path
   FROM auth_logs
   ORDER BY timestamp DESC
   LIMIT 50;
   ```
3. **Verificar perfil do usuário:**
   ```sql
   SELECT * FROM profiles WHERE user_id = '<user_id>';
   ```

---

## Mitigações

### Rate limiting de auth
- Aguardar cooldown (geralmente 60s).
- Se persistente, verificar se há bot/abuso.

### Sessão não persiste
- Verificar localStorage do navegador (storage cheio?).
- Limpar cookies/storage e re-logar.

---

## Escalonamento

| Condição | Ação |
|---|---|
| >10% dos logins falhando em 5 min | SEV-1 |
| Supabase Auth degradado | Monitorar status do Supabase |

---

## Monitoramento de abuso em funções públicas

Funções cobertas: `platform-signup`, `admin-users`.

1. Consultar agregados recentes:
   ```sql
   select *
   from public.get_public_function_anomaly_candidates('15 minutes');
   ```
2. Se houver anomalia:
   - Validar distribuição de `status_code` e `outcome` em `public.function_request_logs`.
   - Verificar explosão por `principal` (IP/user) e bloquear origem em WAF quando necessário.
   - Revisar `APP_ALLOWED_ORIGINS` se houver tráfego suspeito cross-origin.
3. Abrir incidente quando:
   - `error_rate >= 20%` por 15 min, ou
   - `429 >= 20` por 15 min, ou
   - volume > baseline esperado.

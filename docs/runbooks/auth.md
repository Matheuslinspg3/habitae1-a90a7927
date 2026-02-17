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

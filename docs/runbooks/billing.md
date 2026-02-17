# Runbook: Billing & Webhooks

**Owner:** Backend / Billing  
**Última revisão:** 2026-02-17

---

## Sintomas típicos

| Sintoma | Possível causa |
|---|---|
| Webhook retornando 401 | `ASAAS_WEBHOOK_TOKEN` incorreto ou ausente |
| Webhook retornando 500 | Erro de processamento interno (DB/lógica) |
| Assinatura não ativa após pagamento | Webhook não recebido ou evento duplicado não processado |
| Cobrança PIX sem confirmação | Webhook `PAYMENT_CONFIRMED` não chegou ou falha de lookup |

---

## Diagnóstico rápido (primeiros 5 minutos)

1. **Verificar logs da Edge Function:**
   - Buscar por `service: "billing-webhook"` nos logs.
   - Filtrar por `level: "error"`.

2. **Verificar tabela `billing_webhook_logs`:**
   ```sql
   SELECT id, event_type, event_status, processed, created_at, error_message
   FROM billing_webhook_logs
   ORDER BY created_at DESC
   LIMIT 20;
   ```

3. **Verificar status da assinatura:**
   ```sql
   SELECT id, status, provider_subscription_id, current_period_end
   FROM subscriptions
   WHERE organization_id = '<org_id>'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

4. **Verificar pagamentos:**
   ```sql
   SELECT id, status, provider_payment_id, paid_at
   FROM billing_payments
   WHERE organization_id = '<org_id>'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

---

## Mitigações

### Webhook não processa evento
1. Verificar se `ASAAS_WEBHOOK_TOKEN` está configurado nas secrets.
2. Verificar se a função `billing-webhook` está deployada com `verify_jwt = false`.
3. Reprocessar manualmente atualizando `processed = false` no log e re-enviando via painel Asaas.

### Assinatura presa em "pending"
1. Verificar se PIX foi pago no painel Asaas.
2. Se sim, atualizar manualmente:
   ```sql
   UPDATE subscriptions SET status = 'active' WHERE id = '<sub_id>';
   UPDATE billing_payments SET status = 'confirmed', paid_at = now() WHERE provider_payment_id = '<payment_id>';
   ```

### CORS bloqueando requests
1. Verificar `APP_ALLOWED_ORIGINS` nas secrets da função billing.
2. Deve conter a URL do app (ex: `https://habitae1.lovable.app`).

---

## Escalonamento

| Condição | Ação |
|---|---|
| >5 webhooks falhando em 1h | SEV-2 → Investigar imediatamente |
| Receita impactada (pagamentos não confirmando) | SEV-1 → Escalar para liderança |
| Asaas API fora do ar | Monitorar, eventos serão reprocessados quando voltarem |

---

## Critério de encerramento
- Webhooks processando normalmente.
- Nenhum backlog de eventos pendentes > 5 min.
- Assinaturas refletindo status correto.

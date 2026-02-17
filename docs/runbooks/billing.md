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

---

## Rotação operacional de secrets (com evidência)

### Escopo obrigatório
- Asaas: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`
- Cloudinary: `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- R2: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`

### Frequência
- Rotação preventiva: **a cada 90 dias**.
- Rotação emergencial: imediata após suspeita de vazamento/incidente.

### Procedimento padrão (por provedor)
1. Gerar nova credencial no console do provedor.
2. Atualizar secrets por ambiente (`staging` e `production`) no GitHub/Supabase.
3. Executar smoke test:
   - Asaas: criar cliente/assinatura em sandbox.
   - Cloudinary: consultar endpoint de usage.
   - R2: listar objetos via rotina `storage-metrics`.
4. Revogar credencial antiga no provedor.
5. Registrar evidência no ticket de mudança/incidente.

### Evidências mínimas aceitas
- Captura de tela do painel do provedor mostrando chave nova ativa.
- Log de deploy/execução do checklist de secrets no pipeline.
- Trecho de logs sem erro `PROVIDER_AUTH_SECRET_INVALID` após rotação.
- Link do ticket com data/hora, owner e ambientes afetados.

---

## Playbook de revogação (segredo inválido/expirado)

1. **Detectar** alerta por padrão `PROVIDER_AUTH_SECRET_INVALID`.
2. **Conter**: pausar jobs que dependem do provedor afetado (se aplicável).
3. **Rotacionar** secret no provedor e atualizar secrets no ambiente afetado.
4. **Validar** com smoke test + inspeção de logs.
5. **Revogar** credencial anterior explicitamente no provedor.
6. **Comunicar** status e impacto (SEV-1/SEV-2 conforme receita/fluxo).
7. **Fechar** incidente com evidência anexada e ações preventivas.

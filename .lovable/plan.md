

## Plano: Assinatura recorrente via cartão + preços de teste

### O que muda

1. **Cartão → Assinatura recorrente no Asaas** (não mais cobrança avulsa)
   - No `billing/index.ts`, o bloco `credit_card` atualmente cria um `/payments` com `billingType: "UNDEFINED"`. Será substituído por uma chamada a `/subscriptions` do Asaas com `billingType: "CREDIT_CARD"`, que cria uma assinatura recorrente gerenciada pelo Asaas (com cobrança automática e possibilidade de cancelamento a qualquer momento).
   - O `provider_subscription_id` será preenchido com o ID da subscription do Asaas, permitindo cancelamento via API.
   - O Asaas gera automaticamente um link de pagamento (`invoiceUrl`) na primeira cobrança da assinatura — o fluxo do checkout no front continua igual (redireciona para o link
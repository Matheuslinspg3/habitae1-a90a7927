# Catálogo de SLOs — Habitae

Data de criação: 2026-02-17  
Owner: Engenharia  
Revisão: Mensal

---

## SLO-01: Autenticação (Login)

| Campo | Valor |
|---|---|
| **SLI** | `logins_ok / tentativas_validas` (excluindo credencial inválida intencional) |
| **Janela** | 30 dias rolling |
| **Target** | 99,9% |
| **Error budget** | 0,1% (~43 min/mês) |
| **Burn-rate rápido** | 5m/1h → >14x budget = **SEV-1** |
| **Burn-rate lento** | 30m/6h → >6x budget = **SEV-2** |
| **Owner** | Auth team |
| **Runbook** | `docs/runbooks/auth.md` |

---

## SLO-02: Disponibilidade API Edge (rotas críticas)

| Campo | Valor |
|---|---|
| **SLI** | `% requests 2xx/3xx` nas funções `billing`, `billing-webhook`, `platform-signup` |
| **Janela** | 30 dias rolling |
| **Target** | 99,9% |
| **Error budget** | 0,1% |
| **Burn-rate rápido** | 5m/1h → >14x = **SEV-1** |
| **Burn-rate lento** | 30m/6h → >6x = **SEV-2** |
| **Owner** | Backend team |
| **Runbook** | `docs/runbooks/billing.md` |

---

## SLO-03: Latência Backend (p95)

| Campo | Valor |
|---|---|
| **SLI** | `p95 latency` por endpoint crítico |
| **Janela** | 7 dias (operacional), 30 dias (governança) |
| **Target** | p95 < 400ms (rotas comuns), p99 < 1200ms (rotas pesadas) |
| **Owner** | Backend team |
| **Runbook** | `docs/runbooks/performance.md` |

---

## SLO-04: Integridade Billing Webhook

| Campo | Valor |
|---|---|
| **SLI** | `% webhooks processados com sucesso / total recebidos` |
| **Janela** | 30 dias |
| **Target** | 99,95% |
| **Métrica adicional** | Backlog pendente > 5 min = alerta |
| **Owner** | Billing team |
| **Runbook** | `docs/runbooks/billing.md` |

---

## SLO-05: Importação (Jobs)

| Campo | Valor |
|---|---|
| **SLI** | `jobs_success / jobs_total` |
| **Janela** | 30 dias |
| **Target** | ≥ 99,5% |
| **Latência** | p95 atraso de fila < 5 min |
| **Owner** | Integrations team |
| **Runbook** | `docs/runbooks/imports.md` |

---

## SLO-06: UX Web (RUM)

| Campo | Valor |
|---|---|
| **SLI** | Core Web Vitals p75 por rota principal |
| **Target** | LCP < 2,5s · INP < 200ms · CLS < 0,1 |
| **Janela** | Por release + 30 dias |
| **Policy** | Piora >10% por 2 releases bloqueia rollout |
| **Owner** | Frontend team |

---

## Error Budget Policy

1. Consumo **<50%** na metade da janela → operação normal.
2. Consumo **50–75%** → congelar mudanças não-críticas no serviço afetado.
3. Consumo **>75%** → apenas hotfixes e rollbacks permitidos.
4. Consumo **100%** → incident review obrigatório + freeze até próxima janela.

---

## Revisão e Governança

- Revisão mensal em reunião de confiabilidade.
- SLOs ajustados com base em dados reais após 90 dias de coleta.
- Novos serviços devem ter SLO definido antes de ir para produção.

---

## Alertas de abuso — funções públicas (`verify_jwt=false`)

### Métricas base

Fonte: tabela `public.function_request_logs` (Edge Functions).

- `public_function_requests_total{function_name}`: total de requests no intervalo.
- `public_function_errors_total{function_name}`: total com status >= 400.
- `public_function_rate_limited_total{function_name}`: total com status = 429.
- `public_function_unique_principals{function_name}`: contagem de `principal` distintos no intervalo.

### Regras de alerta recomendadas

1. **Pico de volume (Warning)**
   - Condição: `total_requests >= 100` em 15 minutos.
2. **Erro anômalo (Critical)**
   - Condição: `error_rate >= 20%` em 15 minutos.
3. **Rate limit elevado (Warning)**
   - Condição: `status_429 >= 20` em 15 minutos.

### Consulta operacional pronta

Executar periodicamente (cron/Scheduled Function) usando:

```sql
select *
from public.get_public_function_anomaly_candidates('15 minutes');
```

Se houver linhas retornadas, disparar alerta para canal de on-call (Slack/PagerDuty/e-mail).

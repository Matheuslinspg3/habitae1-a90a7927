

## Diagnóstico de Performance — Plataforma Porta do Corretor

### Problemas identificados

**1. Dashboard carrega 8+ queries em paralelo sem priorização**
A página Dashboard dispara simultaneamente:
- `useProperties` (com paginação, inclui TODAS as imagens)
- `useLeads` (com 3 sub-queries: roles, leads ativos, leads inativos)
- `useContracts`
- `useTransactions`
- `useDashboardKPIs` (RPC)
- `useDashboardFunnel` (RPC)
- `useDashboardRanking` (RPC)
- Componentes filhos: `RecentActivities`, `PipelineSummary`, `ConversionFunnel`, `UpcomingAppointments`, `InactivityAlerts`, `MarketplaceMetricsCard`, `MobileTodaySummary`

Isso gera **15+ requests simultâneos** ao backend no primeiro load.

**2. `useProperties` carrega TODAS as imagens para o Dashboard**
A query faz `select(*, property_images(*))` — carrega todas as imagens de todos os imóveis mesmo que o Dashboard só precise de contagens. Para organizações com centenas de imóveis e milhares de fotos, isso é pesadíssimo.

**3. `useLeads` e `useTransactions` sem filtro de organização**
- `useLeads` filtra apenas `is_active = true` sem `organization_id` — potencialmente retorna leads de todas as orgs (depende do RLS, mas o volume de dados pode ser alto)
- `useTransactions` não tem nenhum filtro — carrega TODAS as transações

**4. Nenhuma query tem `staleTime` configurado (exceto leads/roles)**
As queries de properties, contracts e transactions usam o default de 60s do QueryClient, mas são invalidadas por realtime a cada mudança em leads/appointments, causando re-fetches cascata.

**5. Realtime invalida queries demais**
Cada mudança em `leads` ou `appointments` invalida `kpi_metrics`, `agent_ranking`, `funnel_detail` E `leads` — 4 queries re-executadas por cada evento.

---

### Plano de Otimização

**Fase 1 — Reduzir payload das queries do Dashboard (maior impacto)**

- Criar hook `useDashboardStats` dedicado que usa uma **única RPC** (`fn_dashboard_stats`) para retornar contagens de imóveis, leads, contratos e receita — em vez de carregar tabelas inteiras e contar no frontend
- Remover `useProperties`, `useLeads`, `useContracts`, `useTransactions` do Dashboard — esses hooks pesados devem ser usados apenas nas páginas de listagem
- A RPC retornaria: `{ active_properties, total_properties, active_leads, new_leads_week, active_contracts, pending_contracts, monthly_revenue, balance }`

**Fase 2 — Lazy-load componentes abaixo do fold**

- Usar `React.lazy` + `Suspense` ou `IntersectionObserver` para carregar componentes que o usuário precisa rolar para ver: `DetailedFunnel`, `AgentRanking`, `InactivityAlerts`, `MarketplaceMetricsCard`, `RecentActivities`, `TodayTasks`
- Criar componente wrapper `<LazySection>` que só monta o componente quando entra no viewport

**Fase 3 — Otimizar queries restantes**

- Adicionar `staleTime: 5 * 60_000` nas queries de properties, contracts e transactions
- Reduzir invalidações do realtime: usar `refetchInterval` de 30s em vez de realtime para KPIs (dados agregados não precisam de ms de latência)
- Na `useProperties`, criar variante `usePropertiesCount` que faz `select('id', { count: 'exact', head: true })` para páginas que só precisam de contagem

**Fase 4 — Database: criar RPC agregada**

- Criar migration com `fn_dashboard_stats(p_org_id uuid)` que faz todas as contagens em uma única query SQL otimizada no servidor, eliminando 4 round-trips

---

### Detalhes técnicos

```text
ANTES (Dashboard load):
  Browser → 15+ requests paralelos → Backend
  Properties (com imagens) → ~500KB+ payload
  Leads (todos) → ~200KB payload
  Transactions (todas) → ~100KB payload
  + 5 RPCs + 3 sub-queries
  Total: ~1-3s de wait time

DEPOIS (Dashboard load):
  Browser → 1 RPC (fn_dashboard_stats) → ~1KB payload → Stats renderizados
  Browser → 3 RPCs (KPIs, Funnel, Ranking) → lazy quando visíveis
  Browser → componentes abaixo do fold → carregam sob demanda
  Total: ~200-400ms para first meaningful paint
```

### Estimativa de melhoria
- **First paint do Dashboard**: de ~2-3s para ~400ms
- **Payload total**: redução de ~80% no carregamento inicial
- **Requests simultâneos**: de 15+ para 1-4


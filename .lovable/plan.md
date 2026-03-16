

## Etapa 2 — Cache de Dados e Otimização de Queries

### Estado atual

React Query já está instalado e configurado. A maioria dos hooks já usa `useQuery`/`useMutation`. As otimizações da etapa anterior adicionaram `staleTime`, filtros temporais, e `organization_id` a vários hooks. O `GlobalCommandPalette` já busca dados apenas com debounce (não no mount).

### O que ainda precisa ser feito

**1. Atualizar defaults do QueryClient** (`src/App.tsx`)
- Adicionar `gcTime: 10 * 60_000` (atualmente usa o default de 5min)
- Manter `refetchOnWindowFocus: true` (já é o default do React Query)
- Manter `staleTime: 60_000` e `retry: 1` que já estão configurados

**2. Eliminar 4x `useLeads()` no Dashboard** (maior gargalo restante)
- `PipelineSummary`, `ConversionFunnel`, `InactivityAlerts`, e `MobileTodaySummary` cada um chama `useLeads()` que faz 3 queries
- Criar uma RPC `fn_pipeline_summary` que retorna contagens por estágio e leads inativos há +7 dias — substitui as 4 chamadas por 1
- Criar hook `useDashboardPipeline` que consome a RPC
- Refatorar os 4 componentes para usar o novo hook em vez de `useLeads()`

**3. Adicionar `staleTime` e `organization_id` a queries que faltam**
- `useVisits`: adicionar `staleTime: 2 * 60_000`
- `useLeads` (inactive query): adicionar `organization_id` ao queryKey e filtro `.eq('organization_id', ...)`
- `useLeadInteractions`: adicionar `staleTime: 60_000`

**4. Reduzir `SELECT *` nas queries mais pesadas**
- `useLeadInteractions`: trocar `select('*')` por `select('id, type, description, occurred_at, created_by, created_at')`
- `useContracts`: trocar `select('*')` por colunas específicas usadas na listagem
- `useTransactions`: trocar `select('*')` por colunas específicas

**5. Implementar prefetch em navegação**
- Nos links/botões do sidebar (`AppLayout`), adicionar `onMouseEnter` que faz `queryClient.prefetchQuery` para os dados da próxima página
- Prefetch apenas para as 4 rotas principais: `/imoveis` → properties, `/crm` → leads, `/financeiro` → transactions, `/agenda` → appointments

**6. Adicionar `.limit()` em queries sem paginação**
- `useLeads` (inactive): adicionar `.limit(100)` 
- `useTransactions`: adicionar `.limit(500)` (financial page can paginate later)

### Detalhes técnicos — RPC `fn_pipeline_summary`

```sql
CREATE OR REPLACE FUNCTION fn_pipeline_summary(p_org_id uuid)
RETURNS jsonb AS $$
  -- Returns: { stages: [{id, name, color, position, count, total_value}], 
  --            inactive_leads: [{id, name, days_inactive}] (top 10) }
  -- Single query replaces 4x useLeads() calls in dashboard
$$
```

### Arquivos modificados

- `src/App.tsx` — gcTime no QueryClient
- Nova migration SQL — `fn_pipeline_summary`
- Novo `src/hooks/useDashboardPipeline.ts`
- `src/components/dashboard/PipelineSummary.tsx` — usar novo hook
- `src/components/dashboard/ConversionFunnel.tsx` — usar novo hook
- `src/components/dashboard/InactivityAlerts.tsx` — usar novo hook
- `src/components/dashboard/MobileTodaySummary.tsx` — remover useLeads, usar dados existentes
- `src/hooks/useVisits.ts` — staleTime
- `src/hooks/useLeads.ts` — inactive query org filter + limit
- `src/hooks/useLeadInteractions.ts` — staleTime + select columns
- `src/hooks/useContracts.ts` — select columns
- `src/hooks/useTransactions.ts` — select columns + limit
- `src/components/layouts/AppLayout.tsx` — prefetch on hover

### Regras seguidas
- Zero mudanças visuais
- Comportamento idêntico
- Comentários `// PERF:` em cada mudança


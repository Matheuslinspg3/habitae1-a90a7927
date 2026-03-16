

## Relatório de Auditoria de Performance — Porta do Corretor

---

### IMPACTO ALTO

**1. Dashboard sub-componentes chamam `useLeads()` individualmente — 4x a mesma query pesada**
- `PipelineSummary`, `ConversionFunnel`, `InactivityAlerts` e `MobileTodaySummary` cada um chama `useLeads()` independentemente
- `useLeads()` dispara 3 queries separadas: roles, leads ativos (com sub-fetches de properties e brokers), leads inativos
- Mesmo com cache do React Query, cada componente instancia o hook completo, processa dados e executa lógica de broker filtering
- Arquivos: `src/components/dashboard/PipelineSummary.tsx`, `ConversionFunnel.tsx`, `InactivityAlerts.tsx`, `MobileTodaySummary.tsx`, `src/hooks/useLeads.ts`

**2. `useProperties()` carrega TODAS as imagens de TODOS os imóveis com paginação infinita**
- Loop `while(hasMore)` faz `select(*, property_type:property_types(*), images:property_images(*))` em blocos de 1000
- Organizações com 500 imóveis e 10 fotos cada = 5000 registros de imagem carregados de uma vez
- Usado na página Properties que já tem dados suficientes para listar
- Arquivo: `src/hooks/useProperties.ts` (linhas 69-109)

**3. `useLeads()` faz waterfall de 3 queries sequenciais**
- Query principal de leads → depois fetch de properties por IDs → depois fetch de brokers por IDs
- São 3 round-trips sequenciais onde properties e brokers poderiam ser buscados em paralelo com a query principal via join ou parallelização
- Arquivo: `src/hooks/useLeads.ts` (linhas 160-214)

**4. `useTransactions()` e `useContracts()` sem filtro de organização na query**
- `useTransactions()` faz `select(*)` sem `.eq('organization_id', ...)` — depende apenas de RLS
- `useContracts()` também faz `select('*')` sem filtro de org
- Sem paginação — carrega TODAS as transações e contratos da organização
- Arquivos: `src/hooks/useTransactions.ts` (linhas 29-45), `src/hooks/useContracts.ts` (linhas 39-90)

**5. `useAppointments()` carrega TODOS os compromissos sem filtro temporal**
- Faz `select(*, lead:leads(id, name), property:properties(id, title))` sem limite de data
- Usado no Dashboard (via `UpcomingAppointments`, `TodayTasks`, `MobileTodaySummary`) onde apenas compromissos futuros são necessários
- Sem `staleTime` — re-fetcha a cada mount
- Arquivo: `src/hooks/useAppointments.ts` (linhas 28-43)

**6. `useTasks()` carrega TODAS as tarefas sem filtro temporal**
- Faz `select(*, lead:leads(id, name))` sem limite — inclui tarefas concluídas de meses atrás
- Usado no Dashboard (`TodayTasks`, `MobileTodaySummary`) onde apenas tarefas do dia são necessárias
- Sem `staleTime`
- Arquivo: `src/hooks/useTasks.ts` (linhas 56-71)

**7. `DemoContext` recalcula dados a cada render — sem memoização**
- `calculateDemoStats()`, `getTodayDemoTasks()`, `getTodayDemoAppointments()` são chamados no corpo do componente, não em `useMemo`
- O `value` do Provider é um novo objeto a cada render, forçando re-render em todos os consumidores
- Arquivo: `src/contexts/DemoContext.tsx` (linhas 100-105, 146-159)

**8. `AuthContext` value cria novo objeto a cada render**
- O objeto `value` do `AuthContext.Provider` é recriado a cada render sem `useMemo`
- Qualquer setState no AuthProvider (loading, profile, etc.) causa re-render em TODOS os componentes que usam `useAuth()`
- Funções `signUp`, `signIn`, `signOut`, `refreshProfile` não são estabilizadas com `useCallback`
- Arquivo: `src/contexts/AuthContext.tsx` (linhas 238-252)

---

### IMPACTO MÉDIO

**9. Zero uso de `React.memo` em todo o projeto**
- Nenhum componente usa `React.memo` — incluindo componentes de lista como `PropertyCard`, `PropertyListItem`, `StatCard` que renderizam em loop
- Qualquer mudança de estado pai re-renderiza todos os cards da lista
- Busca por `React.memo`: 0 resultados em todo o `src/`

**10. Zero uso de `useCallback` nos componentes do Dashboard**
- Handlers como `onClick`, funções de navegação criados inline em cada render
- Busca por `useCallback` em `src/components/dashboard/`: 0 resultados

**11. Properties page (795 linhas) com 14+ useState no topo**
- 14 estados diferentes no componente raiz (`formOpen`, `editingProperty`, `deleteId`, `selectedIds`, `viewMode`, `pageSize`, etc.)
- Qualquer mudança em qualquer estado re-renderiza o componente inteiro de 795 linhas
- Arquivo: `src/pages/Properties.tsx` (linhas 55-70)

**12. `ImportProgressContext` monta em TODA a aplicação e busca imports ao montar**
- Verifica `import_runs` ativas no mount (useEffect com `checkRunningImports`)
- Cria canal realtime mesmo que o usuário nunca use importação
- Arquivo: `src/contexts/ImportProgressContext.tsx` (linhas 306-354)

**13. `useLeads()` query key não inclui `organization_id`**
- Query key é apenas `['leads']` — se o usuário mudar de organização, dados antigos são servidos do cache
- Sem `staleTime` configurado — usa o default de 60s do QueryClient
- Arquivo: `src/hooks/useLeads.ts` (linha 161)

**14. Recharts importado diretamente (não lazy-loaded)**
- `DetailedFunnel.tsx` importa `{ BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell }` do recharts
- Recharts adiciona ~200KB ao bundle; esse componente está dentro de `LazySection` mas o import é estático
- Arquivo: `src/components/dashboard/DetailedFunnel.tsx` (linha 6)

**15. `GlobalCommandPalette` faz query de properties e leads no mount**
- Componente montado em toda `AppLayout`, busca dados para pesquisa mesmo sem o usuário abrir (Ctrl+K)
- Arquivo: `src/components/GlobalCommandPalette.tsx`

---

### IMPACTO BAIXO

**16. Imagens de propriedades sem `width`/`height` definidos — causam layout shift (CLS)**
- `PropertyCard.tsx` usa `<img>` com `loading="lazy"` mas sem dimensões explícitas
- Depende do container `aspect-video` para sizing, mas até a imagem carregar há layout shift
- Arquivo: `src/components/properties/PropertyCard.tsx` (linhas 144-158)

**17. `date-fns` importado em 64 arquivos — possível duplicação no bundle**
- Vários arquivos importam funções diferentes (`format`, `formatDistanceToNow`, `differenceInDays`, `isToday`, etc.)
- Tree-shaking deve funcionar, mas vale verificar bundle analyzer

**18. `useMarketplaceMetrics` chamado no Dashboard sem verificar se marketplace está ativo**
- `MarketplaceMetricsCard` faz query mesmo se a organização não usa marketplace
- Arquivo: `src/components/marketplace/MarketplaceMetricsCard.tsx`

**19. `useTransactions()` recalcula `chartData` (12 meses) a cada render**
- `getChartData(12)` é chamado no corpo do hook, não memoizado
- Itera todos os transactions 12 vezes (uma por mês)
- Arquivo: `src/hooks/useTransactions.ts` (linhas 158-181, 188)

**20. `StalePropertiesAlert` já foi otimizado mas ainda faz query própria**
- Busca `id, title, updated_at` de properties — poderia estar na RPC `fn_dashboard_stats`
- Arquivo: `src/components/dashboard/StalePropertiesAlert.tsx`

---

### Resumo dos gargalos por prioridade de correção

```text
PRIORIDADE 1 (maior impacto):
  → useLeads() chamado 4x no Dashboard (PipelineSummary, ConversionFunnel, InactivityAlerts, MobileTodaySummary)
  → useProperties() carrega todas as imagens
  → AuthContext + DemoContext sem memoização do value
  → useAppointments/useTasks sem filtro temporal

PRIORIDADE 2:
  → Zero React.memo em componentes de lista
  → Properties.tsx com 14 useState causando re-renders
  → ImportProgressContext monta globalmente
  → Recharts não lazy-loaded

PRIORIDADE 3:
  → Imagens sem width/height
  → chartData não memoizado
  → GlobalCommandPalette busca dados no mount
```


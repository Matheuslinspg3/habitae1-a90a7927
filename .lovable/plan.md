
## Etapa 3 — Otimizacao de Componentes React (Re-renders)

### Estado atual
- `LeadCard` e `KanbanColumn` ja usam `memo` — nao precisam de mudanca
- `PropertyCard`, `PropertyListItem`, `SelectablePropertyCard`, `StatCard`, `MobileOwnerCard`, `AdLeadRow` nao usam `memo`
- `Properties.tsx` ja usa `useCallback` e `useMemo` extensivamente (bom estado)
- `OwnerTable.tsx` tem filtro `filtered` sem `useMemo` e handlers inline sem `useCallback`
- `StatCard` usa um module-level `cardIndex++` que e problematico (nao determinista em re-renders)
- `DetailedFunnel.tsx` tem `stagesWithRates` sem `useMemo`

### Plano de mudancas

**1. Adicionar `React.memo` a componentes de lista** (maior impacto)
- `PropertyCard` — wrap com `memo`
- `PropertyListItem` — wrap com `memo`
- `SelectablePropertyCard` — wrap com `memo`
- `StatCard` — wrap com `memo`, remover `cardIndex` global (passar cor via prop ou usar index do array)
- `MobileOwnerCard` — wrap com `memo`
- `AdLeadRow` — wrap com `memo`

**2. Memoizar calculos derivados**
- `OwnerTable.tsx`: memoizar `filtered` com `useMemo`
- `DetailedFunnel.tsx`: memoizar `stagesWithRates` com `useMemo`
- `KanbanBoard.tsx` linha 373: `propertyOptions` ja esta memoizado (ok)

**3. Estabilizar handlers com `useCallback`**
- `OwnerTable.tsx`: `toggleAll`, `toggleOne`, `handleBulkDelete` — wrap com `useCallback`
- `Properties.tsx` linhas 503-505: `handleCreateClick`, `handleEditClick`, `handleDeleteClick` — wrap com `useCallback` (sao passados como props para list items)
- `KanbanBoard.tsx`: `handleTemperatureChange` — wrap com `useCallback`

**4. Corrigir `StatCard` cardIndex**
- O module-level `cardIndex++` e um anti-pattern que produz cores inconsistentes em re-renders
- Passar `colorIndex` como prop ou usar a posicao do array no Dashboard

### Arquivos modificados
- `src/components/properties/PropertyCard.tsx` — memo
- `src/components/properties/PropertyListItem.tsx` — memo
- `src/components/properties/SelectablePropertyCard.tsx` — memo
- `src/components/dashboard/StatCard.tsx` — memo + colorIndex prop
- `src/components/owners/MobileOwnerCard.tsx` — memo
- `src/components/ads/AdLeadRow.tsx` — memo
- `src/components/owners/OwnerTable.tsx` — useMemo + useCallback
- `src/components/dashboard/DetailedFunnel.tsx` — useMemo
- `src/pages/Properties.tsx` — useCallback para 3 handlers
- `src/components/crm/KanbanBoard.tsx` — useCallback para handleTemperatureChange
- `src/pages/Dashboard.tsx` — pass colorIndex to StatCard

### Regras
- Zero mudancas visuais
- Zero mudancas de logica de negocio
- Comentarios `// PERF:` em cada mudanca

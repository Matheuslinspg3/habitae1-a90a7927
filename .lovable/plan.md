

## Etapa 4 — Code Splitting e Lazy Loading

### Estado atual
- Todas as rotas ja usam `React.lazy()` com um unico `<Suspense>` no topo do App — OK
- Componentes pesados (mapas, charts, forms, modais) sao importados eagerly dentro das paginas
- Nao ha lodash no projeto. `date-fns` e `lucide-react` usam imports individuais (tree-shaking funciona)

### Plano de mudancas

**1. Lazy-load componentes pesados com bibliotecas grandes**

| Componente | Biblioteca | Onde e importado | Acao |
|---|---|---|---|
| `PropertyMapView` | leaflet (~40KB) | `Properties.tsx` | `lazy()` — so carrega quando `viewMode === "map"` |
| `DetailedFunnel` | recharts (~200KB) | Dashboard (ja em `LazySection`) | Trocar import estatico por `lazy()` dentro do `LazySection` |
| `LeadScoreSection` | recharts (~200KB) | `LeadDetails.tsx` | `lazy()` com Suspense — so carrega quando lead detail abre |

**2. Lazy-load formularios e modais pesados**

| Componente | Onde | Acao |
|---|---|---|
| `PropertyForm` (~800 linhas + sub-tabs) | `Properties.tsx`, `PropertyDetails.tsx` | `lazy()` — so carrega quando usuario clica "Novo" ou "Editar" |
| `ContractForm` | `Financial.tsx` | `lazy()` — so carrega quando usuario abre form |
| `ContractDetails` | `Financial.tsx` | `lazy()` — so carrega quando usuario clica "Ver detalhes" |
| `LandingPageEditor` | `PropertyDetails.tsx` | `lazy()` — so carrega quando usuario abre editor |
| `PdfImportDialog` | `Properties.tsx` | `lazy()` — so carrega quando usuario clica importar |
| `DuplicatePropertyDialog` | `Properties.tsx` | `lazy()` — so carrega quando duplicatas sao detectadas |
| `DuplicateReviewDialog` | `Properties.tsx` | `lazy()` — so carrega quando revisao de duplicatas |

**3. Nao precisa de mudanca**
- Rotas: ja sao todas `lazy()` — OK
- `lodash`: nao usado — OK
- `date-fns`, `lucide-react`: imports individuais, tree-shaking funciona — OK
- `ImageViewer`/`ImageGallery`: importados em paginas que ja sao lazy — ja sao code-split naturalmente

### Arquivos modificados

- `src/pages/Properties.tsx` — lazy PropertyMapView, PropertyForm, PdfImportDialog, DuplicatePropertyDialog, DuplicateReviewDialog
- `src/pages/PropertyDetails.tsx` — lazy PropertyForm, LandingPageEditor
- `src/pages/Financial.tsx` — lazy ContractForm, ContractDetails
- `src/components/dashboard/DetailedFunnel.tsx` — lazy recharts (dynamic import)
- `src/components/crm/LeadDetails.tsx` — lazy LeadScoreSection

### Padrao de implementacao

Para cada componente lazy-loaded dentro de uma pagina:
```tsx
// PERF: lazy load - [motivo] avoids loading [lib] until needed
const PropertyMapView = lazy(() => import("@/components/properties/PropertyMapView"));

// No JSX, wrapping com Suspense local:
{viewMode === "map" && (
  <Suspense fallback={<Skeleton className="h-[500px] w-full rounded-xl" />}>
    <PropertyMapView ... />
  </Suspense>
)}
```

Para o recharts no `DetailedFunnel`, usar dynamic import dos componentes do recharts dentro do componente (ou extrair o chart para um sub-componente lazy).

### Chunks criados e motivos

1. **`PropertyMapView` chunk** — isola leaflet (~40KB gzip). So carrega quando usuario seleciona view "mapa"
2. **`PropertyForm` chunk** — formulario complexo com ~800 linhas + sub-componentes. So carrega ao clicar "Novo/Editar"
3. **`ContractForm` chunk** — formulario com zod schema + sub-tabs. So carrega ao abrir form
4. **`ContractDetails` chunk** — painel de detalhes. So carrega ao clicar "Ver"
5. **`LandingPageEditor` chunk** — editor de landing page. So carrega ao abrir editor
6. **`PdfImportDialog` chunk** — dialog de importacao PDF. So carrega ao clicar importar
7. **`DuplicatePropertyDialog` + `DuplicateReviewDialog` chunk** — dialogs de duplicatas. So carregam quando detectadas
8. **`LeadScoreSection` chunk** — isola recharts do detail view. So carrega ao abrir lead
9. **`DetailedFunnel` chart sub-component** — isola recharts do dashboard. So carrega quando secao visivel

### Regras
- Zero mudancas visuais (Suspense fallbacks usam Skeleton matching o layout)
- Comportamento identico
- Comentarios `// PERF: lazy load` em cada mudanca


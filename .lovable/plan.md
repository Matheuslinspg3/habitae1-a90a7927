

# Otimizar tempo de build com lazy loading de rotas

## Problema
O projeto importa todas as ~35 páginas de forma estática no `App.tsx`, o que gera um bundle grande e aumenta o tempo de build. Combinado com dependências pesadas como `firebase`, `recharts`, `leaflet` e `pdf-lib`, isso contribui para builds lentos.

## Solução
Implementar **lazy loading** (carregamento sob demanda) em todas as rotas usando `React.lazy` e `Suspense`. Isso divide o código em pedaços menores, reduzindo o tamanho do bundle principal e potencialmente acelerando o build.

## O que vai mudar

### 1. Lazy loading de todas as páginas em `src/App.tsx`
- Substituir todos os `import` estáticos de páginas por `React.lazy(() => import(...))`
- Envolver as `Routes` com `React.Suspense` e um fallback de loading
- Isso faz com que cada página seja um "chunk" separado, carregado apenas quando necessário

### 2. Componente de loading (fallback)
- Criar um componente simples de loading (spinner) para exibir enquanto a página carrega

## Detalhes técnicos

Exemplo da mudança no `App.tsx`:

```typescript
// ANTES (importação estática - tudo num bundle só)
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";

// DEPOIS (lazy loading - cada página é um chunk separado)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Properties = lazy(() => import("./pages/Properties"));
```

Todas as ~35 páginas serão convertidas para lazy loading. Componentes de layout (`AppLayout`, `AppMobileLayout`, providers) continuarão com importação estática pois são necessários imediatamente.

---

**Nota importante:** O tempo de atualização no "Up to date" também depende da infraestrutura do Lovable (build server, CDN). Esta otimização melhora o que está ao nosso controle no código, mas atrasos de infraestrutura podem persistir em alguns casos.


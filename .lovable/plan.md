

## Etapa 6 — Performance Percebida e Polimento Final

### Diagnóstico

**Skeletons ausentes (texto "Carregando..." em vez de skeleton):**
- `MetaAdDetail.tsx` — texto puro "Carregando..."
- `MetaLeadsInboxContent.tsx` — texto puro
- `AdDetailStats.tsx` — texto puro
- `AdDetailLeads.tsx` — texto puro
- `MetaStatsContent.tsx` — texto puro
- `MetaLeadsInbox.tsx` — texto puro
- `MetaStats.tsx` — texto puro
- `LeadInteractionTimeline.tsx` — texto puro
- `OwnerDetails.tsx` — texto puro
- `ImportPendencies.tsx` — spinner sem skeleton

**Debounce ausente:**
- `Search.tsx` (app consumer) — `city` input dispara query a cada tecla, sem debounce. Precisa de debounce 300ms.

**Debounce já implementado (OK):**
- `GlobalCommandPalette` (250ms), `GeradorVideoContent` (300ms), `GeradorAnuncios` (300ms), `UnifiedPropertySearch` — todos OK.

**Console.logs em produção:**
- ~196 `console.log` em 16 arquivos. Maioria são logs de debug em `PdfImportDialog`, `useImageUpload`, `onesignal`, `imageVariants`, `usePushNotifications`. Estes são úteis para debugging de upload/push — não remover, mas converter para condicional `import.meta.env.DEV`.

**Keys com index:**
- 75 usos de `key={index}` em 8 arquivos. Maioria são listas estáticas (amenities, features, breadcrumbs, image galleries) onde index key é aceitável. Não há listas reordenáveis usando index keys.

**Marketplace skeleton:**
- Usa `<Skeleton className="h-[420px]" />` genérico em vez de card skeleton estruturado.

### Plano de mudanças

**1. Debounce no Search.tsx do consumer app**
- Adicionar `debouncedCity` com debounce de 300ms
- Passar `debouncedCity` para `useConsumerProperties` em vez de `city`

**2. Substituir "Carregando..." por skeletons nos componentes de ads/meta**
- `MetaAdDetail.tsx` — skeleton com tabs layout
- `AdDetailLeads.tsx` — skeleton com rows
- `AdDetailStats.tsx` — skeleton com cards
- `MetaLeadsInboxContent.tsx` — skeleton com list items
- `MetaStatsContent.tsx` — skeleton com chart placeholder
- `LeadInteractionTimeline.tsx` — skeleton com timeline items
- `OwnerDetails.tsx` — skeleton com info blocks
- `ImportPendencies.tsx` — skeleton com table rows

**3. Marketplace skeleton melhorado**
- Trocar `<Skeleton className="h-[420px]" />` por card skeletons estruturados (imagem + texto + badges)

**4. Console.logs condicionais**
- Criar helper `debugLog()` que só loga em dev
- Substituir `console.log` nos arquivos de produção por `if (import.meta.env.DEV)` guard nos principais: `useImageUpload.ts`, `PdfImportDialog.tsx`, `imageVariants.ts`

**5. Optimistic update no ConsumerPropertyCard (favoritar)**
- Já implementado no `useConsumerFavorites` com `onMutate` — OK, não precisa de mudança

### Arquivos modificados

- `src/pages/app/Search.tsx` — debounce no input de cidade
- `src/pages/ads/MetaAdDetail.tsx` — skeleton
- `src/components/ads/AdDetailLeads.tsx` — skeleton
- `src/components/ads/AdDetailStats.tsx` — skeleton
- `src/components/ads/MetaLeadsInboxContent.tsx` — skeleton
- `src/components/ads/MetaStatsContent.tsx` — skeleton
- `src/components/crm/LeadInteractionTimeline.tsx` — skeleton
- `src/components/owners/OwnerDetails.tsx` — skeleton
- `src/pages/ImportPendencies.tsx` — skeleton
- `src/pages/Marketplace.tsx` — card skeleton melhorado
- `src/hooks/useImageUpload.ts` — console.log condicional
- `src/components/properties/PdfImportDialog.tsx` — console.log condicional
- `src/lib/imageVariants.ts` — console.log condicional

### Resumo geral das 6 etapas (será incluído na implementação)

Ao final, incluirei um resumo consolidado de todas as etapas com:
- O que foi encontrado e corrigido em cada etapa
- Sugestões de melhorias manuais (índices no banco, compressão de imagens, CDN)


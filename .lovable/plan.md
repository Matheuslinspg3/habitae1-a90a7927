

## Etapa 5 — Otimização de Assets e Imagens

### Estado atual
- `OptimizedImage` componente existe mas **não é usado em nenhum lugar** — apenas definido
- 34 arquivos usam `<img>` direto, sem placeholders skeleton nem aspect-ratio consistente
- Google Fonts já usa `&display=swap` — OK
- `preconnect` para fonts.googleapis.com e fonts.gstatic.com já existe — OK
- Fontes dinâmicas usam `loadFont()` sob demanda — OK, não precisa de mudança
- Ícones usam lucide-react com imports individuais (tree-shaking funciona) — OK
- `PropertyCard` já tem `loading="lazy"` e `decoding="async"` nas imagens, mas sem skeleton placeholder

### Plano de mudanças

**1. Aprimorar `OptimizedImage` para ser o componente universal**

Adicionar ao componente existente:
- Prop `aspectRatio` (default `"video"` = 16/9) para reservar espaço e eliminar CLS
- Prop `fetchPriority` para imagens above-the-fold
- Skeleton placeholder animado enquanto a imagem carrega (bg-muted com pulse)
- Wrapper `<div>` com aspect-ratio que reserva o espaço antes do load

**2. Substituir `<img>` direto pelo `OptimizedImage` nos componentes principais**

Arquivos com maior impacto (listas com muitas imagens):
- `PropertyCard.tsx` — cover image (lista principal de imóveis)
- `PropertyListItem.tsx` — thumbnail da lista
- `ImageViewer.tsx` — galeria de imagens (thumbnails + grid)
- `MarketplacePropertyDetails.tsx` — galeria pública
- `PropertyDetail.tsx` (app/) — carrossel público
- `AdImageGenerator.tsx` — seletor de fotos para anúncios
- `BrandSettingsContent.tsx` — logo da marca
- `LeadSuggestedProperties.tsx` — thumbnails de sugestões

**3. Fontes — reduzir carga inicial no `index.html`**

O `index.html` carrega 10 famílias de fontes eagerly (Inter, DM Sans, Playfair, Montserrat, Raleway, Poppins, Lora, Outfit, Space Grotesk, Sora). Apenas **Inter** e **DM Sans** são usadas no CSS base. As outras 8 são fontes opcionais para branding/marketing e já têm o sistema `loadFont()` dinâmico.

Ação: remover as 8 fontes opcionais do `<link>` no `index.html`, manter apenas Inter e DM Sans. As outras serão carregadas sob demanda pelo `loadFont()` quando necessário.

**4. Não precisa de mudança**
- `font-display: swap` — já configurado via `&display=swap` no Google Fonts URL
- `preconnect` — já existe para fonts.googleapis e gstatic
- SVGs/ícones — todos via lucide-react (componentes React inline), sem SVGs externos pesados
- `loadFont()` dinâmico — já funciona bem para fontes opcionais

### Arquivos modificados

- `src/components/ui/optimized-image.tsx` — adicionar aspectRatio, fetchPriority, skeleton placeholder
- `src/components/properties/PropertyCard.tsx` — usar OptimizedImage
- `src/components/properties/PropertyListItem.tsx` — usar OptimizedImage
- `src/components/properties/ImageViewer.tsx` — usar OptimizedImage nos thumbnails/grid
- `src/pages/MarketplacePropertyDetails.tsx` — usar OptimizedImage
- `src/pages/app/PropertyDetail.tsx` — usar OptimizedImage
- `src/components/ads/AdImageGenerator.tsx` — usar OptimizedImage
- `src/components/crm/LeadSuggestedProperties.tsx` — usar OptimizedImage
- `index.html` — remover 8 fontes opcionais do link (manter Inter + DM Sans)

### Impacto estimado

- **~30+ imagens** otimizadas com skeleton placeholder + aspect-ratio
- **CLS eliminado** em todas as listas de imóveis (PropertyCard, PropertyListItem, ImageViewer)
- **~200KB de fontes** removidas do carregamento inicial (8 famílias × ~25KB cada)
- **Carregamento inicial** significativamente mais rápido (menos fontes blocking render)




## Problema

A visualização de imagens (ImageViewer) está com problemas graves de responsividade em mobile:

1. **ImageViewer (lightbox/dialog)**: O `DialogContent` usa `max-w-[95vw] max-h-[95vh]` mas a imagem usa `max-w-full max-h-full` dentro de um container `absolute inset-0` — no mobile isso causa a imagem deslocada e cortada (como no screenshot). Não há suporte a touch (swipe, pinch-to-zoom). O hint de "roda do mouse" aparece em mobile sem sentido.

2. **ImageGallery (grid)**: O layout `grid-cols-[2fr_1fr] max-h-[480px]` não se adapta bem a telas pequenas. A cover usa `aspect-auto` no desktop o que pode distorcer.

3. **PropertyDetail (app mobile)**: Usa Embla carousel separado — este funciona razoavelmente mas as imagens podem não preencher corretamente.

## Plano de Correções

### 1. Reescrever o ImageViewer para mobile-first
- Usar `w-screen h-screen` (fullscreen) em mobile em vez de `95vw/95vh`
- Remover `DialogContent` padrão e usar um overlay fullscreen customizado
- Adicionar suporte a **swipe horizontal** (touch) para navegar entre imagens usando Embla carousel dentro do viewer
- Adicionar suporte a **pinch-to-zoom** via CSS `touch-action: pinch-zoom` e transformações touch
- Esconder hint de "roda do mouse" em mobile, mostrar apenas em desktop
- Tornar os controles (zoom, rotação) mais compactos em mobile
- Thumbnails na parte inferior com scroll horizontal touch-friendly

### 2. Corrigir ImageGallery para mobile
- No layout de 3+ imagens, a cover em mobile deve usar `aspect-[4/3]` consistente
- Melhorar os thumbnails horizontais mobile: tamanho maior, melhor espaçamento

### 3. Arquivos a modificar
- `src/components/properties/ImageViewer.tsx` — Componentes ImageViewer e ImageGallery (principal)

### Detalhes técnicos

**ImageViewer**:
- DialogContent: trocar para `max-w-full max-h-full sm:max-w-[95vw] sm:max-h-[95vh]` e adicionar `p-0` com `data-[state=open]:!rounded-none` em mobile
- Imagem principal: usar `object-contain` com `w-full h-full` dentro de um flex container centralizado
- Adicionar touch handlers: `onTouchStart/onTouchMove/onTouchEnd` para swipe navigation
- Header de controles: compactar em mobile com `gap-1` e ícones menores
- Esconder zoom hint em mobile (`hidden md:block`)

**ImageGallery**:
- Cover mobile: garantir `aspect-[4/3]` e `object-cover` consistente
- Remover `max-h-[480px]` que limita artificialmente em telas diversas


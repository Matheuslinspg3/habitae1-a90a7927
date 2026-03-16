
Problema identificado no código atual:

1. O `ImageViewer` ainda usa o `DialogContent` padrão centralizado (`fixed + translate + max-w/max-h`), ou seja, no celular ele não abre como visualizador fullscreen real.
2. O botão com ícone `Maximize2` não “maximiza” nada: ele chama `handleReset()`. Isso explica a sensação de bug.
3. A `ImageGallery` exibe a capa (`is_cover`) mas abre o viewer por índice da lista original. Se a capa não estiver na posição 0, a foto aberta pode ser diferente da foto tocada.
4. O `DialogContent` compartilhado adiciona um botão de fechar extra automaticamente, enquanto o viewer já renderiza outro `X`, o que também piora o layout.
5. Em fotos verticais, o espaço útil fica ainda menor porque header + thumbnails + dialog centralizado comprimem a imagem.

Plano de correção:

1. Normalizar a ordem das imagens
- Criar uma lista ordenada com a capa primeiro.
- Fazer a galeria e o viewer usarem exatamente essa mesma ordem.
- Corrigir os cliques da capa e das miniaturas para abrir a imagem certa.

2. Reestruturar o visualizador para mobile-first
- Trocar o container atual por um viewer fullscreen de verdade no mobile (`w-screen h-screen`).
- Reduzir o impacto do header e da faixa de thumbnails.
- Garantir área útil máxima para fotos verticais e horizontais.

3. Corrigir o botão “maximizar”
- Separar claramente “resetar zoom” de “maximizar”.
- No mínimo, renomear/trocar o ícone para refletir o comportamento real.
- Em mobile, remover esse botão se ele não agregar valor.

4. Ajustar o palco da imagem
- Manter a imagem centralizada com `object-contain`.
- Aplicar `touch-action` adequada.
- Resetar zoom/posição ao trocar imagem.
- Impedir estados que causem deslocamento estranho ao abrir.

5. Limpar conflitos do dialog
- Evitar o botão de fechar duplicado.
- Usar uma estrutura de overlay/viewer específica para imagem, em vez de depender do `DialogContent` padrão sem adaptação.

Arquivos a ajustar:
- `src/components/properties/ImageViewer.tsx`
- possivelmente `src/components/ui/dialog.tsx` apenas se eu precisar permitir uma variante sem botão close automático; se não, resolvo tudo no próprio viewer.

Resultado esperado:
- Ao tocar na imagem, ela abre corretamente e em tela cheia no celular.
- A foto aberta corresponde exatamente à miniatura tocada.
- O botão atual deixa de “bugar” porque passa a ter função correta ou some no mobile.
- Fotos verticais deixam de ficar espremidas ou visualmente quebradas.

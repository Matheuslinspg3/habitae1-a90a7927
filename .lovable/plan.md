

# Corrigir: Imoveis permanecem "em revisao" apos edicao

## Problema

Quando um imovel e importado com problemas (ex: sem fotos, sem metragem), ele recebe `import_status = 'incomplete'` e aparece na pagina de pendencias. Porem, quando o usuario edita o imovel e corrige os problemas, o sistema **nunca atualiza** o `import_status` para `complete` nem limpa o `import_warnings`. O imovel continua aparecendo na lista de pendencias indefinidamente.

### Causa raiz

A funcao `updateProperty` em `src/hooks/useProperties.ts` faz um `update` na tabela `properties` apenas com os dados do formulario. Os campos `import_status` e `import_warnings` nunca sao incluidos na atualizacao.

## Solucao

Apos cada atualizacao bem-sucedida de um imovel que tenha `import_status = 'incomplete'` ou `'needs_retry'`, o sistema deve:

1. Re-avaliar os warnings com base nos dados atualizados
2. Limpar os warnings que foram resolvidos
3. Se nao restar nenhum warning, mudar `import_status` para `'complete'`

### Mudancas

**Arquivo: `src/hooks/useProperties.ts`** (funcao `updateProperty`)

Apos o update bem-sucedido do imovel, adicionar logica para:

```text
1. Verificar se o imovel atualizado tinha import_status 'incomplete' ou 'needs_retry'
2. Se sim, re-calcular os warnings:
   - 'sem_fotos' / 'fotos_ausentes': verificar se agora tem imagens (images.length > 0)
   - 'sem_metragem' / 'metragem_ausente': verificar se area_useful ou area_total foi preenchido
   - 'sem_descricao': verificar se description foi preenchido
   - 'sem_proprietario': verificar se owner foi vinculado
3. Atualizar import_warnings com apenas os warnings restantes
4. Se nenhum warning restante, setar import_status = 'complete'
```

**Arquivo: `src/pages/PropertyDetails.tsx`** (funcao `handleFormSubmit`)

Apos chamar `updateProperty`, verificar se o imovel tinha pendencias e atualizar o status:

- Passar os dados necessarios para a re-avaliacao (imagens, area, descricao)
- Chamar um update adicional no `import_status` e `import_warnings` se necessario

### Abordagem tecnica detalhada

A implementacao mais limpa e adicionar a logica de re-avaliacao diretamente no `updateProperty` do hook `useProperties.ts`. Apos o `.update()` principal:

```
// Pseudo-codigo
if (updated.import_status === 'incomplete' || updated.import_status === 'needs_retry') {
  const remainingWarnings = [];
  
  // Checar fotos
  const hasImages = images && images.length > 0;
  if (!hasImages) {
    const { count } = await supabase.from('property_images').select('id', { count: 'exact' }).eq('property_id', id);
    if (!count || count === 0) remainingWarnings.push('sem_fotos');
  }
  
  // Checar metragem
  if (!data.area_useful && !data.area_total) remainingWarnings.push('sem_metragem');
  
  // Checar descricao
  if (!data.description) remainingWarnings.push('sem_descricao');
  
  // Checar proprietario
  const { count: ownerCount } = await supabase.from('property_owners').select('id', { count: 'exact' }).eq('property_id', id);
  if (!ownerCount) remainingWarnings.push('sem_proprietario');
  
  // Atualizar
  await supabase.from('properties').update({
    import_warnings: remainingWarnings.length > 0 ? remainingWarnings : null,
    import_status: remainingWarnings.length > 0 ? 'incomplete' : 'complete',
  }).eq('id', id);
}
```

## Impacto

- Imoveis editados na area de revisao passarao automaticamente para status `complete` quando os problemas forem corrigidos
- O banner de pendencias e a pagina de pendencias refletirao as correcoes em tempo real
- Nenhuma mudanca no fluxo de criacao ou importacao -- apenas o fluxo de edicao e afetado

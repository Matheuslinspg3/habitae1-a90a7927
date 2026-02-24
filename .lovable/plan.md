

# Corrigir: Alteracoes nao salvas ao editar imovel

## Problema Identificado

Ao editar um imovel, o formulario **nao submete** porque a validacao do campo `owner_name` (Nome do Proprietario) falha silenciosamente.

### Causa raiz

1. O schema Zod exige `owner_name` com no minimo 1 caractere: `z.string().min(1, ...)`
2. Quando o formulario abre para edicao, os campos do proprietario sao resetados com valores vazios (`owner_name: ""`)
3. O proprietario ja existe no banco de dados (tabela `property_owners`), mas esses dados **nao sao carregados** no formulario
4. A funcao `handleInvalidSubmit` so verifica erros nas abas (basico, valores, etc.), mas o campo `owner_name` fica na secao separada `OwnerSection`, entao o usuario nao ve o erro

Resultado: o botao "Salvar Alteracoes" nao faz nada -- nao aparece erro, nao salva.

## Solucao

### 1. Tornar `owner_name` opcional ao editar

Quando o imovel ja existe (edicao), o proprietario ja esta vinculado. Nao faz sentido exigir novamente. Vamos tornar o campo opcional:

- Alterar o schema para `owner_name: z.string().optional().nullable()` (ou usar `.or(z.literal(""))`)
- Remover o `min(1)` que bloqueia a submissao

### 2. Pre-carregar dados do proprietario ao editar

No `PropertyForm`, quando `property` for passado (edicao), buscar os dados do proprietario existente e preencher os campos:

- Buscar de `property_owners` onde `property_id = property.id` e `is_primary = true`
- Preencher `owner_name`, `owner_phone`, `owner_email`, `owner_document`, `owner_notes`

### 3. Melhorar feedback de erro

Adicionar a secao do proprietario na checagem de erros do `handleInvalidSubmit`, para que se houver erro, o usuario seja notificado adequadamente.

## Detalhes Tecnicos

**Arquivo: `src/components/properties/PropertyForm.tsx`**
- Alterar o schema: `owner_name: z.string().optional().nullable().or(z.literal(""))` -- remover `.min(1)`
- No `useEffect` que reseta o formulario quando `property` muda, buscar o proprietario existente via Supabase e preencher os campos owner_*
- No `handleInvalidSubmit`, verificar tambem campos do proprietario e mostrar mensagem adequada

**Arquivo: `src/components/properties/form/OwnerSection.tsx`**
- Remover o asterisco (*) do label quando estiver em modo edicao (opcional)

## Impacto

- Corrige o bug que impede qualquer alteracao em imoveis existentes
- Melhora a experiencia preenchendo automaticamente os dados do proprietario ao editar
- Nao afeta o fluxo de criacao de novos imoveis




# Plano: Area de Proprietarios com Deduplicacao por Telefone

## Resumo

Criar uma nova arquitetura de proprietarios centralizada, onde cada proprietario e identificado pelo numero de telefone. Nomes duplicados sao agrupados automaticamente: o nome mais frequente vira o "nome principal" e os demais ficam como "apelidos" (aliases). Toda criacao ou importacao de imovel vincula ao proprietario existente ou cria um novo.

---

## Nova Arquitetura do Banco de Dados

### Tabela `owners` (nova - cadastro centralizado)

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | Identificador unico |
| organization_id | uuid FK | Organizacao |
| primary_name | text NOT NULL | Nome principal (o mais frequente) |
| phone | text NOT NULL | Telefone - chave de deduplicacao |
| email | text | E-mail |
| document | text | CPF/CNPJ |
| notes | text | Observacoes |
| created_at | timestamptz | Data de criacao |
| updated_at | timestamptz | Data de atualizacao |

- Constraint UNIQUE em (organization_id, phone) para garantir deduplicacao

### Tabela `owner_aliases` (nova - apelidos/nomes alternativos)

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | Identificador |
| owner_id | uuid FK | Referencia ao proprietario |
| name | text NOT NULL | Nome alternativo |
| occurrence_count | integer | Quantas vezes esse nome apareceu |
| created_at | timestamptz | Data de criacao |

### Tabela `property_owners` (modificada)

Adicionar coluna:
- `owner_id` (uuid FK, nullable inicialmente) - referencia ao proprietario centralizado na tabela `owners`

Isso permite manter a compatibilidade atual enquanto migra para o novo modelo.

---

## Logica de Deduplicacao

Ao criar ou importar um imovel com dados de proprietario:

```text
1. Normalizar o telefone (remover espacos, parenteses, tracos)
2. Buscar na tabela "owners" por (organization_id, telefone normalizado)
3. SE encontrou:
   a. Incrementar occurrence_count do alias com esse nome
   b. OU criar novo alias se nome nao existe
   c. Recalcular primary_name (o alias com maior occurrence_count)
   d. Vincular property_owners.owner_id ao owner existente
4. SE nao encontrou:
   a. Criar novo owner com primary_name = nome informado
   b. Criar primeiro alias com occurrence_count = 1
   c. Vincular property_owners.owner_id ao novo owner
```

---

## Novos Arquivos

| Arquivo | Descricao |
|---|---|
| `src/pages/Owners.tsx` | Pagina principal com listagem, busca, metricas |
| `src/components/owners/OwnerTable.tsx` | Tabela com busca por nome/telefone/documento |
| `src/components/owners/OwnerForm.tsx` | Dialog de cadastro/edicao |
| `src/components/owners/OwnerDetails.tsx` | Painel lateral com dados, aliases e imoveis vinculados |
| `src/components/owners/OwnerAliases.tsx` | Componente para exibir/gerenciar apelidos |
| `src/hooks/useOwners.ts` | Hook CRUD completo com logica de deduplicacao |

## Arquivos Modificados

| Arquivo | Alteracao |
|---|---|
| `src/App.tsx` | Nova rota `/proprietarios` |
| `src/components/AppSidebar.tsx` | Item "Proprietarios" no menu (icone UserCog, abaixo de Imoveis) |
| `src/hooks/useProperties.ts` | Ao criar imovel, chamar logica de deduplicacao antes de inserir em property_owners |
| `src/components/properties/form/OwnerSection.tsx` | Autocomplete busca da tabela owners (nao mais property_owners) |
| `src/hooks/usePropertyOwners.ts` | Adaptar para buscar de owners ao inves de agrupar property_owners |
| `supabase/functions/imobzi-import/index.ts` | Usar deduplicacao ao importar proprietarios |
| `supabase/functions/imobzi-process/index.ts` | Usar deduplicacao ao processar proprietarios |

---

## Funcionalidades da Pagina de Proprietarios

1. **Listagem** - Tabela com nome principal, telefone, e-mail, documento, quantidade de imoveis vinculados
2. **Busca** - Por nome (principal ou alias), telefone, documento
3. **Metricas** - Total de proprietarios, proprietarios com mais imoveis, proprietarios sem imoveis
4. **Cadastro manual** - Criar proprietario diretamente (sem precisar criar imovel)
5. **Edicao** - Alterar dados, trocar nome principal por um alias, adicionar/remover aliases
6. **Detalhes** - Ver todos os aliases, lista de imoveis vinculados com link direto
7. **Exclusao** - Remover proprietario (com confirmacao e desvinculacao dos imoveis)

---

## Migracao de Dados

A migracao SQL vai:
1. Criar tabelas `owners` e `owner_aliases`
2. Popular `owners` a partir dos registros existentes em `property_owners`, agrupando por telefone normalizado
3. Para cada grupo de telefone, o nome mais frequente vira `primary_name` e os demais viram aliases
4. Adicionar coluna `owner_id` em `property_owners` e preencher com os IDs correspondentes
5. Configurar RLS seguindo o padrao existente (isolamento por organization_id)

---

## Detalhes Tecnicos

### Funcao de normalizacao de telefone (SQL)

Sera criada uma funcao `normalize_phone(text)` que remove todos os caracteres nao-numericos para garantir comparacao consistente.

### RLS das novas tabelas

Seguira o padrao existente:
- SELECT/INSERT/UPDATE/DELETE restritos a `organization_id = get_user_organization_id()` ou `is_member_of_org(organization_id)`

### Hook useOwners

```text
- listOwners(): busca todos da org com contagem de imoveis e aliases
- createOwner(): cria com deduplicacao automatica por telefone
- updateOwner(): atualiza dados, permite trocar primary_name
- deleteOwner(): remove owner + aliases (property_owners.owner_id vira null)
- findOrCreateByPhone(): logica central de deduplicacao usada por importacao e criacao de imoveis
- mergeOwners(): unificar dois proprietarios manualmente (futuro)
```


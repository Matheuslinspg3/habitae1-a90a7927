
# Correcao: Constraint de temperatura bloqueando "Prioridade Maxima"

## Problema
O banco de dados tem um CHECK constraint na coluna `temperature` da tabela `leads` que so permite 3 valores: `'frio'`, `'morno'`, `'quente'`. Porem, a interface (CRM) oferece uma 4a opcao chamada "Prioridade Maxima" com valor `'prioridade'`. Ao tentar salvar, o banco rejeita o valor e exibe o erro.

## Causa raiz
A migration `20260213214110` criou a coluna com:
```sql
ADD COLUMN IF NOT EXISTS temperature text CHECK (temperature IN ('frio', 'morno', 'quente'))
```
Depois, o codigo frontend adicionou a opcao `'prioridade'` nos arquivos `useLeads.ts` e `LeadQuickActions.tsx`, mas o constraint no banco nunca foi atualizado.

## Solucao
Uma unica migration SQL para atualizar o constraint, adicionando `'prioridade'` como valor valido:

```sql
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_temperature_check;
ALTER TABLE leads ADD CONSTRAINT leads_temperature_check
  CHECK (temperature IN ('frio', 'morno', 'quente', 'prioridade'));
```

Nenhuma alteracao de codigo frontend e necessaria -- a UI ja envia o valor correto, so o banco que estava rejeitando.

## Detalhes tecnicos

| Item | Detalhe |
|---|---|
| Arquivo alterado | Nova migration SQL |
| Tabela afetada | `leads` |
| Constraint | `leads_temperature_check` |
| Valores antes | `frio`, `morno`, `quente` |
| Valores depois | `frio`, `morno`, `quente`, `prioridade` |
| Risco | Nenhum -- apenas amplia os valores aceitos |

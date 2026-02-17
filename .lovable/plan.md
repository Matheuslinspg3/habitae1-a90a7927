

## Corrigir os 2 avisos do DB Linter

### 1. Mover extensao `pg_net` para o schema `extensions`

Uma migracao SQL para mover a extensao do schema `public` para `extensions`, impedindo que funcoes internas da extensao fiquem acessiveis via API publica.

```sql
ALTER EXTENSION pg_net SET SCHEMA extensions;
```

### 2. Ativar protecao contra senhas comprometidas

Usar a ferramenta `configure-auth` do Lovable Cloud para habilitar a verificacao de senhas vazadas (HaveIBeenPwned). Isso impede que usuarios cadastrem senhas que ja apareceram em vazamentos de dados conhecidos.

---

### Detalhes tecnicos

| Aviso | Severidade | Acao |
|---|---|---|
| `pg_net` no schema `public` | Baixa | Migracao SQL: `ALTER EXTENSION pg_net SET SCHEMA extensions` |
| Senhas vazadas desabilitada | Media | Configurar auth: habilitar `hibp` (compromised password check) |

Nenhuma alteracao de codigo frontend e necessaria. Ambas as correcoes sao puramente de infraestrutura/backend.


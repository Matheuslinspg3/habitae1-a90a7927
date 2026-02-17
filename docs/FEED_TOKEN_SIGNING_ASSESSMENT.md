# Avaliação: token assinado de curta duração vs segredo estático na query

## Situação atual (após este hardening)
- O feed usa `feed_token` randômico por integração e agora com rotação periódica (campo `token_rotation_days` + `token_rotated_at`).
- Existe endpoint autenticado para rotação manual (`portal-xml-feed` com `action=rotate_token`) e regeneração auditada (`action=regenerate`).
- A função evita logar query string com token e sanitiza mensagens de erro para não expor `token=`.

## Opção A — Segredo estático rotacionável (implementada)
### Prós
- Compatibilidade máxima com portais legados que aceitam apenas URL fixa.
- Implementação simples e baixo risco operacional.
- Revogação imediata via rotação manual.

### Contras
- Se a URL vazar, o token vale até a próxima rotação.
- Requer disciplina de rotação e observabilidade.

## Opção B — Token assinado curto (HMAC/JWT)
### Prós
- Reduz janela de abuso (expiração curta).
- Pode carregar claims de `feed_id`, `organization_id`, `exp`, `nonce`.

### Contras
- Vários portais não conseguem renovar token dinamicamente nem setar header customizado.
- Links com expiração curta quebram ingestão assíncrona do lado do portal (fetch em horários imprevisíveis).
- Aumenta complexidade de suporte e troubleshooting para integrações B2B.

## Recomendação
1. **Curto prazo (adotado):** manter segredo randômico com rotação automática + rotação manual auditada.
2. **Médio prazo:** suportar `x-feed-token` como método preferencial quando o portal permitir header customizado (já aceito na função).
3. **Longo prazo:** oferecer modo opcional de token assinado curto **apenas** para consumidores que suportem refresh programático (não como padrão universal).

## Critério de migração para JWT/HMAC curto
Migrar somente quando houver evidência de que os principais consumidores:
- suportam renovação automática antes do `exp`;
- suportam retry com token novo sem intervenção humana;
- e a operação possua monitoramento de falhas por expiração.

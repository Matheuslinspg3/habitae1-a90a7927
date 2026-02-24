
# Atualizar para Porta v3.1.9

Atualizar o numero da versao de `3.1.8` para `3.1.9` em 4 locais:

1. **`public/version.json`** - Arquivo estatico usado pelo polling de atualizacao (versao e buildTime)
2. **`src/main.tsx`** - Constante `CURRENT_VERSION` usada para comparar com o version.json
3. **`src/components/MobileTopBar.tsx`** - Label de versao visivel no mobile
4. **`src/components/layouts/AppLayout.tsx`** - Label "Porta v3.1.9" visivel no desktop (canto inferior esquerdo)

Todas as alteracoes sao simples substituicoes de texto `3.1.8` por `3.1.9`.

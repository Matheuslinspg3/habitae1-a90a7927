

# Alterar Senha de Usuario pelo Painel Developer

## Objetivo
Adicionar um botao na aba "Usuarios" do Painel Developer que permite ao developer redefinir a senha de qualquer usuario informando o email.

## Solucao

### 1. Edge Function `admin-users` - Adicionar endpoint PATCH
Adicionar um handler `PATCH` na edge function existente `supabase/functions/admin-users/index.ts` que:
- Recebe `{ user_id, new_password }` no body
- Valida que a senha tem no minimo 6 caracteres
- Usa `adminClient.auth.admin.updateUserById(user_id, { password })` para alterar a senha
- Mantem a mesma verificacao de role `developer` que ja existe

### 2. UsersTab - Adicionar botao de redefinir senha
No componente `src/components/developer/UsersTab.tsx`:
- Adicionar um icone de "chave" (KeyRound do lucide-react) ao lado do botao de excluir em cada linha da tabela
- Ao clicar, abrir um `AlertDialog` com um campo de input para a nova senha
- Ao confirmar, chamar a edge function `admin-users` com metodo PATCH enviando `user_id` e `new_password`
- Exibir toast de sucesso ou erro

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/admin-users/index.ts` | Adicionar handler PATCH para `updateUserById` |
| `src/components/developer/UsersTab.tsx` | Adicionar botao + dialog de redefinir senha por linha |

## Detalhes tecnicos

**Edge Function - novo bloco PATCH:**
```typescript
if (req.method === "PATCH") {
  const { user_id, new_password } = await req.json();
  if (!user_id || !new_password) throw new Error("user_id and new_password required");
  if (new_password.length < 6) throw new Error("Password must be at least 6 characters");
  const { error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
  if (error) throw error;
  return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

**Frontend - Dialog de redefinir senha:**
- Input do tipo `password` com placeholder "Nova senha (min. 6 caracteres)"
- Botao de confirmar desabilitado enquanto a senha tiver menos de 6 caracteres
- Chamada fetch com `method: "PATCH"` para a edge function
- Toast de confirmacao com o nome do usuario

## Seguranca
- Apenas usuarios com role `developer` podem executar esta acao (verificacao ja existente na edge function)
- A senha nao e exibida em logs (a edge function ja usa `safeMsg` para erros)
- Validacao de tamanho minimo no frontend e backend

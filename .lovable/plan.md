

# Plano: Corrigir Notificacoes Push (OneSignal)

## Problema Diagnosticado

O erro "All included players are not subscribed" indica que o OneSignal recebe o pedido de push corretamente, encontra o `external_id` do usuario, mas **nenhum dispositivo tem uma inscricao push ativa** associada a esse usuario.

A causa raiz e um **conflito de inicializacao**: o SDK v16 do OneSignal usa o padrao `OneSignalDeferred` (fila de comandos), mas o codigo atual chama `OneSignal.init()` diretamente, o que pode causar inicializacao duplicada ou silenciosamente falhar sem registrar o token push.

## Solucao

### 1. Reescrever `src/lib/onesignal.ts` usando o padrao oficial `OneSignalDeferred`

O SDK v16 espera que comandos sejam enfileirados via `window.OneSignalDeferred`, e NAO chamados diretamente via `window.OneSignal.init()`.

Mudancas:
- Remover a chamada manual `waitForSDK()` + `OneSignal.init()`
- Usar `window.OneSignalDeferred.push(async (OneSignal) => { ... })` que e o padrao oficial
- Garantir que `login(userId)` so execute depois que o `init` completar via a mesma fila
- Adicionar retry com backoff no `loginOneSignal` para garantir que o token seja registrado
- Adicionar polling para confirmar que o `PushSubscription.token` existe apos login

### 2. Atualizar `index.html` para inicializacao via `OneSignalDeferred`

Mudancas:
- Inicializar a fila `window.OneSignalDeferred = window.OneSignalDeferred || []` antes do script do SDK
- Mover a chamada `init()` para dentro da fila deferred

### 3. Simplificar `src/main.tsx`

- Remover a chamada `initOneSignal()` do main.tsx (a inicializacao sera feita pela fila deferred automaticamente)
- O login continuara sendo feito no `AuthContext`

### 4. Atualizar `src/contexts/AuthContext.tsx`

- Garantir que `loginOneSignal(userId)` use `await` para capturar erros
- Adicionar log de diagnostico no login

### 5. Atualizar `src/hooks/usePushNotifications.ts`

- Simplificar o fluxo de `subscribe` para usar o padrao deferred
- Melhorar o estado de `isSubscribed` com polling mais robusto apos opt-in

### 6. Melhorar `supabase/functions/send-push/index.ts`

- Adicionar log do `external_id` sendo buscado para facilitar debug
- Adicionar tentativa de envio via `include_subscription_ids` como fallback caso `include_aliases` falhe

## Detalhes Tecnicos

### `src/lib/onesignal.ts` (reescrita principal)

```text
Fluxo atual (quebrado):
  main.tsx -> initOneSignal() -> waitForSDK() -> OneSignal.init()
  AuthContext -> loginOneSignal() -> initOneSignal() -> OneSignal.login()

Fluxo novo (correto):
  index.html -> OneSignalDeferred = []
  index.html -> <script src="OneSignalSDK.page.js">
  lib/onesignal.ts -> OneSignalDeferred.push(async (OS) => { OS.init({...}) })
  AuthContext -> loginOneSignal() -> aguarda SDK pronto -> OS.login(userId)
```

A funcao `initOneSignal()` vai:
1. Buscar o App ID via edge function (com cache)
2. Enfileirar `init()` via `OneSignalDeferred.push()`
3. Resolver uma Promise quando o SDK estiver pronto
4. Marcar `sdkReady = true`

A funcao `loginOneSignal(userId)` vai:
1. Aguardar `initOneSignal()` completar
2. Chamar `OneSignal.login(userId)`
3. Verificar se `PushSubscription.optedIn === false` e chamar `optIn()` se permissao ja concedida
4. Fazer polling por ate 5s para confirmar que o token foi gerado
5. Logar resultado com diagnostico

### `index.html`

Adicionar antes do script do SDK:
```html
<script>window.OneSignalDeferred = window.OneSignalDeferred || [];</script>
```

### `src/main.tsx`

Remover `initOneSignal()` — sera chamado pelo AuthContext quando o usuario logar.

### `send-push/index.ts`

Melhorar logging para incluir o `user_id` tentado e resposta completa da API.

## Arquivos Modificados

| Arquivo | Acao |
|---------|------|
| `src/lib/onesignal.ts` | Reescrever usando padrao OneSignalDeferred |
| `index.html` | Adicionar inicializacao da fila deferred |
| `src/main.tsx` | Remover chamada `initOneSignal()` |
| `src/contexts/AuthContext.tsx` | Melhorar chamada loginOneSignal com await |
| `src/hooks/usePushNotifications.ts` | Ajustar para novo fluxo |
| `supabase/functions/send-push/index.ts` | Melhorar logging e diagnostico |

## Resultado Esperado

Apos o deploy:
1. O SDK inicializa corretamente via fila deferred (padrao oficial v16)
2. O login associa o `external_id` ao dispositivo
3. O token push e registrado e confirmado via polling
4. O `send-push` encontra o dispositivo e entrega a notificacao
5. Deve-se fazer logout e login novamente no PC e celular para testar


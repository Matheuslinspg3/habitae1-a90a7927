
# Plano: Corrigir Notificações Push

## Problema Identificado

A raiz do problema sao dois bugs no registro do Service Worker:

1. **Conflito de escopo**: O Service Worker do PWA (VitePWA/Workbox) e o Service Worker do Firebase tentam se registrar no mesmo escopo (`/`). Quando isso acontece, um substitui o outro, e o Firebase perde o controle das notificacoes push.

2. **Uso errado de `getRegistration`**: O codigo atual usa `getRegistration("/firebase-messaging-sw.js")`, mas essa funcao busca por **escopo**, nao por URL do script. Resultado: nunca encontra o Service Worker do Firebase, e o `getToken` recebe `undefined` como registration.

## Solucao

Registrar o Service Worker do Firebase com um escopo dedicado (`/firebase-cloud-messaging-push-scope/`), separado do escopo do PWA.

---

## Alteracoes

### 1. `src/hooks/usePushNotifications.ts`

Corrigir o registro do Service Worker para usar escopo dedicado:

```typescript
// ANTES (bugado):
let swReg = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
if (!swReg) {
  swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
}

// DEPOIS (corrigido):
const FIREBASE_SW_SCOPE = "/firebase-cloud-messaging-push-scope/";
let swReg = await navigator.serviceWorker.getRegistration(FIREBASE_SW_SCOPE);
if (!swReg) {
  swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: FIREBASE_SW_SCOPE
  });
  await swReg.update();
}
```

### 2. `src/lib/firebase.ts`

Atualizar `requestPushToken` para buscar o SW pelo escopo correto:

```typescript
// ANTES:
const registration = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");

// DEPOIS:
const FIREBASE_SW_SCOPE = "/firebase-cloud-messaging-push-scope/";
let registration = await navigator.serviceWorker.getRegistration(FIREBASE_SW_SCOPE);
if (!registration) {
  registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: FIREBASE_SW_SCOPE
  });
}
```

Tambem remover o bloco de `postMessage` que nao e mais necessario (a config ja esta hardcoded no SW).

### 3. `public/firebase-messaging-sw.js`

Adicionar log de debug temporario para confirmar que o SW esta ativo:

```javascript
console.log("[firebase-messaging-sw] Service Worker ativo, Firebase inicializado");
```

---

## Detalhes Tecnicos

- `navigator.serviceWorker.register(scriptURL, { scope })` define o escopo de atuacao do SW
- `navigator.serviceWorker.getRegistration(scope)` busca um SW pelo seu escopo, **nao** pela URL do script
- O escopo `/firebase-cloud-messaging-push-scope/` e o padrao recomendado pelo Firebase para evitar conflitos com outros Service Workers
- O VitePWA continuara funcionando normalmente no escopo `/` sem interferencia

## Apos Implementacao

O usuario precisara:
1. Acessar o app publicado
2. Ir em Configuracoes do navegador e limpar dados do site (para remover SW antigo)
3. Reativar as notificacoes push
4. Testar pelo painel Developer

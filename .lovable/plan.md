
# Plano: Diagnosticar e Corrigir Push Notifications

## Situacao Atual

O backend esta funcionando corretamente - FCM aceita a mensagem e retorna `sent: 1`. O problema esta no lado do cliente: o Service Worker nao esta exibindo a notificacao.

Existem 3 possiveis causas restantes que vamos atacar de uma vez:

---

## Causa 1: Workbox SW consumindo push events

O VitePWA gera um Service Worker Workbox no escopo `/` que pode estar interceptando os eventos de push antes do Firebase SW. Solucao: configurar o Workbox para ignorar push events.

### Alteracao em `vite.config.ts`
Adicionar `ignoreURLParametersMatching` e desabilitar o handler de push no Workbox:

```typescript
workbox: {
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
  navigateFallbackDenylist: [/^\/~oauth/, /^\/firebase-cloud-messaging-push-scope/],
  // ... resto fica igual
}
```

---

## Causa 2: FCM payload precisa incluir `webpush.notification`

Mensagens puramente data-only nao disparam automaticamente o evento `push` em todos os navegadores. A solucao e enviar um payload hibrido: `notification` para o navegador mostrar + `data` para deep linking.

### Alteracao em `supabase/functions/send-push/index.ts`

Restaurar o campo `notification` no payload FCM junto com `data`:

```typescript
body: JSON.stringify({
  message: {
    token: sub.fcm_token,
    notification: {
      title,
      body: message || "",
    },
    webpush: {
      notification: {
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        vibrate: [200, 100, 200],
        tag: notification_type || "default",
        renotify: true,
      },
      fcm_options: {
        link: entity_type && entity_id
          ? getEntityLink(entity_type, entity_id)
          : "/dashboard",
      },
    },
    data: {
      ...notificationData,
      title,
      message: message || "",
    },
  },
}),
```

A chave `webpush.notification` forca o navegador a exibir a notificacao de sistema, mesmo sem interacao do Service Worker. O campo `data` mantem o deep linking.

---

## Causa 3: SW Firebase nao esta registrado/ativo

Pode ser que o SW nao esteja ativo no momento do push. Vamos adicionar uma verificacao visual no PushTestCard.

### Alteracao em `src/components/developer/PushTestCard.tsx`

Adicionar botao "Verificar SW" que checa se o Service Worker do Firebase esta ativo:

```typescript
const checkSW = async () => {
  const reg = await navigator.serviceWorker.getRegistration(
    "/firebase-cloud-messaging-push-scope/"
  );
  if (reg?.active) {
    toast.success(`SW ativo (state: ${reg.active.state})`);
  } else {
    toast.error("SW Firebase NAO encontrado. Reative o push.");
  }
};
```

---

## Causa 4: Remover fallback `push` listener duplicado do SW

O Service Worker atual tem DOIS handlers de push: `onBackgroundMessage` do Firebase SDK e um `addEventListener("push")` manual. Eles podem estar conflitando, com o segundo tentando parsear o payload de forma diferente. Vamos simplificar mantendo apenas o `onBackgroundMessage` e o fallback com protecao contra duplicatas.

### Alteracao em `public/firebase-messaging-sw.js`

Manter o `onBackgroundMessage` como handler principal. Remover o `addEventListener("push")` duplicado que pode causar conflitos.

---

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `vite.config.ts` | Excluir escopo Firebase do Workbox |
| `supabase/functions/send-push/index.ts` | Restaurar payload hibrido `notification` + `webpush` + `data` |
| `public/firebase-messaging-sw.js` | Remover listener `push` duplicado, manter `onBackgroundMessage` |
| `src/components/developer/PushTestCard.tsx` | Adicionar botao "Verificar SW" |

## Apos Implementacao

1. Publicar o app
2. No PC, limpar dados do site (DevTools -> Application -> Clear site data)
3. Acessar o app publicado
4. Clicar "Verificar SW" para confirmar que esta ativo
5. Ativar Push
6. Enviar teste

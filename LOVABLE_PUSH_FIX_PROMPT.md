# Correção Completa das Push Notifications

As notificações push não estão funcionando nem no celular, nem no desktop, nem pelo painel Developer. Fiz uma auditoria completa do código e encontrei os bugs abaixo. Corrija TODOS eles:

## BUG 1 (CRÍTICO): Payload FCM com `title` e `body` ausentes no `webpush.notification`

**Arquivo:** `supabase/functions/send-push/index.ts`

O payload enviado ao FCM v1 API tem `webpush.notification` mas SEM os campos `title` e `body` no nível correto. Eles estão enterrados dentro de `webpush.notification.data`, que é um campo customizado e NÃO é reconhecido pela Web Notification API. Sem `title` e `body` no nível correto, o browser tenta exibir uma notificação vazia (sem título, sem corpo) — que simplesmente não aparece ou aparece em branco.

Além disso, como `webpush.notification` EXISTE no payload, o Firebase SDK trata isso como uma "notification message" e NÃO como "data-only message". Isso significa que o `onBackgroundMessage` do Service Worker pode NÃO ser chamado, quebrando o fallback manual de exibição.

**Correção necessária — Abordagem data-only (mais segura):**

Remova o `webpush` inteiro do payload e use SOMENTE `data`. Assim o Firebase SDK sempre chama `onBackgroundMessage` no Service Worker, e o SW controla a exibição manualmente sem conflitos:

```js
body: JSON.stringify({
  message: {
    token: sub.fcm_token,
    data: {
      ...notificationData,
      title,
      message: message || "",
      icon: `${APP_URL}/pwa-192x192.png`,
      badge: `${APP_URL}/pwa-192x192.png`,
      link: entity_type && entity_id
        ? `${APP_URL}${getEntityLink(entity_type, entity_id)}`
        : `${APP_URL}/dashboard`,
    },
  },
}),
```

Atualize também o comentário para: `// Data-only message — SW controla exibição via onBackgroundMessage`

## BUG 2 (CRÍTICO): Service Worker com fallback `push` listener que pode conflitar

**Arquivo:** `public/firebase-messaging-sw.js`

Com a correção do BUG 1 (agora é data-only), o Firebase SDK vai chamar `onBackgroundMessage` de forma confiável. O fallback `push` listener com delay de 150ms não é mais necessário e pode causar notificações duplicadas.

**Correção:** Remova o `self.addEventListener("push", ...)` inteiro e a variável `bgMessageHandled`. Mantenha SOMENTE o `messaging.onBackgroundMessage(...)` que já faz `normalizePayload` e `showNotification` manual. Atualize o `normalizePayload` para também extrair `icon`, `badge` e `link` do payload `data`:

```js
function normalizePayload(payload) {
  const data = normalizeObject(payload?.data);
  const notification = normalizeObject(payload?.notification);

  const title = data.title || notification.title || "Porta do Corretor";
  const body = data.body || data.message || notification.body || "";
  const collapseKey = data.collapse_key || data.collapseKey || payload?.collapseKey;
  const tag = data.tag || notification.tag || collapseKey || data.notification_type || "default";
  const icon = data.icon || notification.icon || "/pwa-192x192.png";
  const badge = data.badge || notification.badge || "/pwa-192x192.png";
  const link = data.link || notification.link || "/dashboard";

  return { title, body, tag, collapseKey, icon, badge, link, data, notification };
}
```

E o `onBackgroundMessage`:

```js
messaging.onBackgroundMessage((payload) => {
  const normalized = normalizePayload(payload);

  console.log("[firebase-messaging-sw][received]", JSON.stringify({
    messageId: payload?.messageId,
    tag: normalized.tag,
    title: normalized.title,
  }));

  return self.registration.showNotification(normalized.title, {
    body: normalized.body,
    icon: normalized.icon,
    badge: normalized.badge,
    vibrate: [200, 100, 200],
    tag: normalized.tag,
    renotify: true,
    data: {
      ...normalized.data,
      __meta: {
        messageId: payload?.messageId || null,
        receivedAt: new Date().toISOString(),
        source: "firebase-messaging-sw",
      },
    },
  });
});
```

## BUG 3 (IMPORTANTE): Diagnóstico insuficiente no PushTestCard

**Arquivo:** `src/components/developer/PushTestCard.tsx`

Quando o teste de push falha, o erro mostrado é genérico demais. O developer não consegue saber se o problema é de secrets, token expirado, ou edge function não deployada.

**Correção — melhore o diagnóstico:**

1. No `handleTestPush`, após chamar `supabase.functions.invoke("send-push", ...)`, adicione o `data` retornado ao debug log (não só no toast):

```js
const { data, error } = await supabase.functions.invoke("send-push", { body: { ... } });

// Sempre log o resultado completo no debug
addDebug(`📤 Resultado: ${JSON.stringify(data || error)}`);

if (error) throw error;

if (data?.sent > 0) {
  toast.success(`Push enviado! (${data.sent} dispositivo${data.sent > 1 ? "s" : ""})`);
} else if (data?.staleRemoved > 0) {
  toast.warning("Todos os tokens estavam expirados. Desative e reative as notificações push.");
  addDebug("⚠️ Tokens expirados removidos: " + data.staleRemoved);
} else {
  toast.warning("Nenhum dispositivo encontrado. Ative as notificações primeiro.");
}
```

2. No `catch`, detecte erros de configuração:

```js
} catch (e: any) {
  const msg = e.message || "erro desconhecido";
  if (msg.includes("FIREBASE_SERVICE_ACCOUNT_KEY")) {
    toast.error("❌ FIREBASE_SERVICE_ACCOUNT_KEY não configurada nos Secrets do Supabase");
    addDebug("❌ Falta secret: FIREBASE_SERVICE_ACCOUNT_KEY");
  } else if (msg.includes("APP_URL")) {
    toast.error("❌ APP_URL não configurada nos Secrets do Supabase");
    addDebug("❌ Falta secret: APP_URL");
  } else {
    toast.error("Erro ao enviar push: " + msg);
  }
  addDebug(`❌ Erro completo: ${msg}`);
}
```

3. Adicione um botão "Verificar Subscriptions" que consulta a tabela `push_subscriptions` e mostra quantos tokens existem para o usuário atual:

```tsx
const checkSubscriptions = async () => {
  if (!user) return;
  try {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id, fcm_token, created_at, device_info")
      .eq("user_id", user.id);

    if (error) {
      addDebug(`❌ Erro ao consultar subscriptions: ${error.message}`);
      toast.error("Erro ao verificar subscriptions");
      return;
    }

    addDebug(`📋 ${data.length} subscription(s) encontrada(s)`);
    data.forEach((sub, i) => {
      addDebug(`  ${i + 1}. Token: ${sub.fcm_token.substring(0, 20)}... | Criado: ${new Date(sub.created_at).toLocaleString()}`);
    });

    if (data.length === 0) {
      toast.warning("Nenhuma subscription encontrada. Ative as notificações push primeiro.");
    } else {
      toast.success(`${data.length} subscription(s) ativa(s)`);
    }
  } catch (e: any) {
    addDebug(`❌ Erro: ${e.message}`);
  }
};
```

Adicione o botão na UI junto aos outros botões de diagnóstico:

```tsx
<Button
  onClick={checkSubscriptions}
  variant="outline"
  size="sm"
  className="gap-2"
>
  <Bug className="h-4 w-4" />
  Verificar Subscriptions
</Button>
```

## BUG 4 (MÉDIO): Auto-subscribe sem gesto do usuário pode ser bloqueado

**Arquivo:** `src/components/layouts/AppLayout.tsx`

O `subscribe()` é chamado automaticamente após 2 segundos sem gesto do usuário. Browsers modernos (especialmente Chrome mobile e Safari) podem bloquear `Notification.requestPermission()` se não houver interação do usuário.

**Correção:** Em vez de chamar `subscribe()` automaticamente, mostre um toast interativo pedindo para o usuário clicar:

```tsx
useEffect(() => {
  if (isSupported && permission === "default" && !prompted.current) {
    prompted.current = true;
    const timer = setTimeout(() => {
      toast("Quer receber notificações?", {
        description: "Ative para ser avisado sobre novos leads, contratos e compromissos.",
        action: {
          label: "Ativar",
          onClick: () => subscribe(),
        },
        duration: 10000,
      });
    }, 3000);
    return () => clearTimeout(timer);
  }
}, [isSupported, permission, subscribe]);
```

Isso garante que `Notification.requestPermission()` é chamado com um gesto do usuário (click no botão "Ativar" do toast).

## BUG 5 (MÉDIO): Foreground `new Notification()` pode falhar e duplicar

**Arquivo:** `src/hooks/usePushNotifications.ts`

O listener de foreground messages tenta criar `new Notification()` diretamente. Em alguns contextos do browser isso pode falhar silenciosamente, e quando funciona duplica com o toast do Sonner.

**Correção:** O toast do Sonner já é suficiente para foreground. Remova o `new Notification()`:

```tsx
const unsub = onForegroundMessage((payload) => {
  const title = payload?.notification?.title || payload?.data?.title || "Nova notificação";
  const body = payload?.notification?.body || payload?.data?.message || "";
  toast(title, { description: body });
});
```

## Resumo das Alterações

| Arquivo | O que mudar |
|---------|------------|
| `supabase/functions/send-push/index.ts` | Payload data-only: remover `webpush` inteiro, mover tudo para `data` incluindo `icon`, `badge`, `link` |
| `public/firebase-messaging-sw.js` | Remover fallback `push` listener e `bgMessageHandled`. Manter `onBackgroundMessage` com `showNotification`. Atualizar `normalizePayload` para extrair `icon`/`badge`/`link` |
| `src/components/developer/PushTestCard.tsx` | Diagnóstico melhorado: log completo no debug, detecção de secrets faltando, botão "Verificar Subscriptions" |
| `src/components/layouts/AppLayout.tsx` | Toast interativo com botão "Ativar" em vez de auto-subscribe sem gesto |
| `src/hooks/usePushNotifications.ts` | Remover `new Notification()` do foreground handler, manter apenas toast |

## IMPORTANTE: Verificar Secrets no Supabase

Antes de testar, garanta que estes secrets estão configurados no painel Supabase (Edge Functions → Secrets):

- `FIREBASE_SERVICE_ACCOUNT_KEY`: JSON completo da service account do Firebase (baixar em Firebase Console → Project Settings → Service Accounts → Generate New Private Key)
- `APP_URL`: URL da aplicação, ex: `https://habitae1.lovable.app`

## Como Testar Após as Correções

1. Faça deploy da edge function `send-push`
2. Abra o app → aceite as notificações via o toast interativo
3. Vá em `/developer` → clique "Verificar Subscriptions" → confirme que há 1+ token
4. Clique "Enviar Push de Teste" → a notificação deve aparecer no browser/sistema
5. Feche o app/aba → envie outro push via "Enviar Push para Usuário" → deve aparecer como notificação do sistema
6. Teste em mobile (Chrome Android com PWA instalada)

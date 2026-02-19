

# Plano: Corrigir URLs Absolutas no Payload FCM + Diagnostico Local

## Problema Identificado

O FCM retorna `sent: 1` (mensagem aceita pelo Google), mas o navegador nao exibe. Apos analise detalhada, identifiquei a causa raiz:

**O campo `webpush.fcm_options.link` e `webpush.notification.icon` no payload FCM estao usando URLs relativas (`/dashboard`, `/pwa-192x192.png`).** A API FCM v1 para Web Push exige URLs absolutas HTTPS. Com URLs relativas, o navegador descarta silenciosamente a notificacao.

## Alteracoes

### 1. Edge Function `supabase/functions/send-push/index.ts`

Converter todas as URLs para absolutas usando a URL do app publicado:

```typescript
// Adicionar no inicio da funcao handler:
const APP_URL = Deno.env.get("APP_URL") || "https://habitae1.lovable.app";

// No payload webpush:
webpush: {
  notification: {
    icon: `${APP_URL}/pwa-192x192.png`,
    badge: `${APP_URL}/pwa-192x192.png`,
    vibrate: [200, 100, 200],
    tag: notification_type || "default",
    renotify: true,
  },
  fcm_options: {
    link: entity_type && entity_id
      ? `${APP_URL}${getEntityLink(entity_type, entity_id)}`
      : `${APP_URL}/dashboard`,
  },
},
```

### 2. Botao de Teste Local `src/components/developer/PushTestCard.tsx`

Adicionar um botao "Teste Local" que cria uma notificacao diretamente pelo browser (sem FCM) para isolar se o problema e no navegador ou no FCM:

```typescript
const testLocalNotification = () => {
  if (Notification.permission === "granted") {
    new Notification("Teste Local Habitae", {
      body: "Se voce esta vendo isso, o navegador permite notificacoes!",
      icon: "/pwa-192x192.png",
    });
    toast.success("Notificacao local enviada - verifique se apareceu");
  } else {
    toast.error(`Permissao: ${Notification.permission}`);
  }
};
```

Isso permite distinguir entre:
- **Teste local funciona mas FCM nao**: problema no payload FCM (URLs)
- **Teste local tambem nao funciona**: problema no navegador/OS (permissoes bloqueadas)

### 3. Adicionar secret APP_URL (opcional)

Configurar `APP_URL` como secret na edge function com valor `https://habitae1.lovable.app`. Caso nao exista, o fallback hardcoded sera usado.

## Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/send-push/index.ts` | URLs absolutas no payload webpush |
| `src/components/developer/PushTestCard.tsx` | Botao "Teste Local" para diagnostico |

## Apos Implementacao

1. Publicar o app
2. Limpar dados do site no navegador
3. Reativar push
4. Clicar "Teste Local" - se aparecer, o navegador esta OK
5. Clicar "Enviar Push de Teste" - agora deve funcionar com URLs absolutas


# Runbook — OneSignal Web Push (Lovable + GitHub)

## Objetivo
Garantir que o push funcione com estabilidade em produção e evitar falso-positivo de ativação.

## Limitações importantes
- **Lovable preview (iframe)**: o browser pode bloquear Service Worker/Push no contexto embutido.
- **GitHub Pages**: o app pode rodar em subpath (`/repo/`), então o caminho do worker deve respeitar o `BASE_URL`.

## Checklist 100%

### 1) OneSignal Dashboard
1. Em **Web Push > Site URL**, configure a URL final publicada (ex.: GitHub Pages, Vercel, domínio próprio).
2. Em **Allowed Origins**, inclua todos os hosts reais usados em produção.
3. Não use URL de preview temporária/iframe como URL principal.

### 2) Secrets no Supabase (Edge Functions)
Necessários:
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY`

Funções dependentes:
- `onesignal-app-id`
- `notifications-register-device`
- `notifications-test`
- `send-push`

### 3) Front-end
- Worker path/scope devem respeitar `import.meta.env.BASE_URL` para funcionar em raiz e subpath.
- O app só deve considerar inscrito quando houver **token real** (`PushSubscription.token`).
- Em ambiente bloqueado (iframe/insecure), mostrar erro claro para o usuário.

### 4) Teste fim-a-fim
1. Abrir URL publicada em HTTPS (fora de iframe).
2. Ativar push em Configurações.
3. Validar no diagnóstico:
   - `notificationPermission = granted`
   - `pushSubscriptionId != null`
   - `pushToken != null`
4. Executar `notifications-test` e confirmar `recipientsCount > 0`.

## Sintomas comuns e causa provável
- `permission=granted` + `pushToken=null`: subscription ainda não propagou ou worker/scope inválido.
- `recipientsCount=0`: device não registrado em `user_devices`.
- SDK timeout: script carregou, mas ambiente bloqueou init (preview/iframe/insecure).

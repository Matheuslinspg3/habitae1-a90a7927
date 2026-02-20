# Diagnóstico: por que o push não funciona no PC e no celular

## Resumo executivo
A análise do código mostra que o problema mais crítico está no **gatilho SQL que chama a Edge Function de push**: ele depende de configurações (`app.settings.supabase_url` e `app.settings.service_role_key`) que não são definidas em nenhum lugar do repositório. Quando essa chamada falha, o erro é engolido por `EXCEPTION WHEN OTHERS THEN RETURN NEW`, então a notificação é salva no banco mas o push não é enviado.

Além disso, existem fatores secundários que podem bloquear o push em cenários reais (principalmente no celular), como requisito de `organization_id` para assinar token e limitações de suporte do navegador/plataforma.

## Evidências principais

### 1) Trigger de push com dependência de settings não definidas e erro silencioso
No migration que criou o push, o trigger chama:
- `current_setting('app.settings.supabase_url', true)` para montar a URL,
- `current_setting('app.settings.service_role_key', true)` para Authorization.

Se qualquer um vier `NULL`, `net.http_post` falha. O bloco `EXCEPTION WHEN OTHERS` retorna `NEW` e não propaga erro, mascarando o problema.

Arquivo: `supabase/migrations/20260219033803_5856eb88-cd6a-4122-a905-c8b10ca20344.sql`.

### 2) Não há configuração dessas settings no projeto
Buscando no repositório, só existe referência a essas settings no próprio migration do trigger; não há comando que as defina.

Arquivos relevantes:
- `supabase/migrations/20260219033803_5856eb88-cd6a-4122-a905-c8b10ca20344.sql`
- `supabase/config.toml` (não contém configuração de `send-push` nem dessas settings de banco)

### 3) Assinatura de push depende de `profile.organization_id`
No frontend, o subscribe retorna `false` imediatamente se `profile.organization_id` estiver ausente:

```ts
if (!user || !profile?.organization_id || !isSupported) return false;
```

Isso pode afetar usuários em onboarding incompleto ou perfis fora da organização esperada (inclusive no celular e no PC).

Arquivo: `src/hooks/usePushNotifications.ts`.

### 4) Suporte mobile é restrito por navegador/contexto
A UI considera suporte apenas quando há `Notification`, `serviceWorker` e `PushManager`. Em iOS, isso depende de versão/contexto (Safari/PWA instalada), então parte dos usuários de celular pode cair em “não suportado”.

Arquivo: `src/hooks/usePushNotifications.ts` e mensagem em `src/pages/Settings.tsx`.

## Conclusão
Causa raiz mais provável para “não funciona em nenhum dispositivo”:
1. **Trigger SQL de envio de push quebrando silenciosamente** por falta de settings (`supabase_url`/`service_role_key`) no banco.
2. Como o erro é suprimido, o sistema aparenta funcionar (notificação salva), mas nenhum push sai.

## Recomendações práticas
1. **Corrigir o trigger** para usar configuração garantida (URL e auth válidas) e registrar erro observável (log/auditoria).
2. **Adicionar monitoramento** no fluxo `notifications -> trigger -> send-push` (ex.: tabela de tentativas + status).
3. **Validar secrets da função `send-push`** (`FIREBASE_SERVICE_ACCOUNT_KEY`) no ambiente de deploy.
4. **Tratar UX de subscribe** quando `organization_id` estiver ausente com mensagem explícita ao usuário.
5. **Documentar suporte mobile** (iOS exige contexto compatível) para reduzir falso diagnóstico de “bug geral”.


Objetivo: corrigir definitivamente a percepção de que “as configurações do PWA não foram aplicadas” e eliminar inconsistências entre versão, manifesto, Service Worker e app instalado.

1) Diagnóstico consolidado (o que já encontrei no código)
- A configuração PWA existe e está ativa no build (`vite-plugin-pwa` em `vite.config.ts`).
- A versão `3.2.0.3` já está aplicada em:
  - `public/version.json`
  - `src/main.tsx` (`CURRENT_VERSION`)
  - badges de UI (`MobileTopBar` e `AppLayout`).
- O fluxo de atualização do SW já existe (`UpdateBanner` + `SKIP_WAITING` + polling de `/version.json`).
- OneSignal está isolado corretamente em outro escopo de Service Worker (`/push/onesignal/`), sem conflito direto com o SW do app.
- Porém, há 2 causas clássicas que explicam o “não aplicou no PWA”:
  1. Preview/dev não representa comportamento real de PWA instalado (manifest/SW em dev têm limitações).
  2. Manifest e metadados de instalação podem ficar “grudados” no app já instalado, mesmo quando o frontend muda.

2) Causa raiz provável
- O app instalado pode estar usando metadados antigos de instalação (nome/ícone/start URL/theme) em cache do sistema operacional/navegador.
- O mecanismo atual resolve bem atualização de código, mas não garante renovação imediata de metadados de instalação em todos os dispositivos.
- Também há risco de confusão por múltiplas fontes de verdade (versão hardcoded + versão em `version.json` + manifesto gerado).

3) Plano de correção “de uma vez por todas”
Passo A — Unificar versão em fonte única
- Criar constante de versão compartilhada (ex.: `src/config/appVersion.ts`).
- Consumir essa constante em:
  - `main.tsx` (comparação de versão),
  - `MobileTopBar` e `AppLayout` (badge),
  - geração de metadados PWA no `vite.config.ts` (quando possível).
- Resultado: sem divergência manual entre arquivos.

Passo B — Fortalecer invalidação do manifesto
- Ajustar configuração do PWA para facilitar refresh de metadados de instalação:
  - incluir `id` no manifesto (versionável),
  - versionar estrategicamente ícones/manifest quando houver mudança de branding (cache bust explícito),
  - manter `version.json` fora do precache (já está correto).
- Resultado: reduz chance de “app instalado continuar com configuração antiga”.

Passo C — Substituir/combinar polling manual com registro oficial do PWA
- Integrar `virtual:pwa-register` (ou equivalente React) para ciclo oficial de update (detecção + apply update).
- Manter `UpdateBanner`, mas conectado ao status do registrador oficial do SW.
- Resultado: atualização mais previsível e menos dependente de lógica custom.

Passo D — Criar “Reparar PWA” no app (ação única para suporte)
- Adicionar no painel Developer (ou `/instalar`) uma ação “Reparar PWA” que:
  - força `registration.update()`,
  - limpa caches de runtime do app,
  - mostra instrução final de reabrir o app.
- Resultado: quando algum dispositivo “travar” cache, há procedimento interno e reproduzível sem tentativa manual desorganizada.

Passo E — Melhorar observabilidade PWA
- Expandir diagnóstico atual para exibir:
  - URL e versão do manifesto ativo,
  - SW ativo/waiting,
  - versão de build lida de `version.json`,
  - modo de exibição (`standalone` vs browser).
- Resultado: fica claro se o problema é cache, publish pendente ou instalação antiga.

Passo F — Alinhar experiência de instalação
- Revisar `start_url` e fluxo pós-instalação para reduzir percepção de erro:
  - se necessário, usar rota inicial que trate estado autenticado/não autenticado sem parecer “configuração errada”.
- Resultado: o usuário instalado sempre vê uma entrada coerente.

4) Sequência de implementação (arquivos)
- `vite.config.ts`: ajustes de manifesto/estratégia de update.
- `src/main.tsx`: remover versionamento hardcoded e conectar em fonte única.
- `src/components/UpdateBanner.tsx`: integrar com status oficial do registrador SW.
- `src/pages/Install.tsx` e/ou `src/components/developer/PushTestCard.tsx` (ou novo card dev): diagnóstico + ação “Reparar PWA”.
- `src/components/MobileTopBar.tsx` e `src/components/layouts/AppLayout.tsx`: consumir versão centralizada.

5) Critérios de aceite (fim do problema)
- Em build publicado, após nova versão:
  - banner de update aparece,
  - app aplica SW novo sem precisar limpar dados manualmente.
- Diagnóstico mostra versão e SW coerentes com release atual.
- Em dispositivo com cache antigo, botão “Reparar PWA” resolve sem reinstalação completa.
- Nome/ícone/start behavior refletem a versão nova após ciclo de atualização esperado.

6) Riscos e mitigação
- Risco: certos SOs ainda seguram metadados de ícone por mais tempo.
  - Mitigação: versionamento de assets de ícone + `id` de manifesto + ferramenta “Reparar PWA”.
- Risco: mudança de start_url impactar fluxo de auth.
  - Mitigação: validar em usuário logado e deslogado antes de publicar.

7) Resultado esperado
- Processo previsível de atualização PWA, sem divergências de versão e com ferramenta de autorreparo.
- Fim do ciclo “mudei configuração e não aplicou”, com diagnóstico visível e fluxo padronizado para correção.

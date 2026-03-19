# Auth Migration Strategy

## Resumo executivo
A aplicação usa Supabase Auth em múltiplos fluxos críticos e **não depende apenas de login/senha tradicional**. Como as senhas atuais não são exportáveis no formato utilizável no destino, a estratégia mais segura é:

1. **preservar os `auth.users.id` atuais** no ambiente destino para evitar remapeamento massivo de FKs;
2. **importar usuários com senha temporária não divulgada** ou hash placeholder controlado;
3. **executar campanha de reset em massa operada pelo backend**;
4. **forçar reautenticação após o cutover**;
5. **manter rollback operacional claro**, sem trocar produção até a validação completa.

## Como o projeto usa auth hoje
### Login principal
- Login por email/senha via `supabase.auth.signInWithPassword`.
- Fluxo presente no frontend e encapsulado em `AuthContext`.

### Cadastro self-service
- Cadastro padrão via `supabase.auth.signUp` para criação de conta com metadata.
- O app depende de sessão Supabase padrão no frontend.

### Convites / onboarding assistido
- `platform-signup` cria usuários via `auth.admin.createUser`.
- `accept-invite` vincula usuários autenticados a convites organizacionais.
- O vínculo entre `profiles`, `organizations` e `user_roles` depende fortemente da **estabilidade do `user_id`**.

### Recuperação de senha
- `send-reset-email` usa `auth.admin.generateLink({ type: "recovery" })` e Resend para enviar links customizados.
- Há também uso de `supabase.auth.resetPasswordForEmail` em telas autenticadas.

### Export atual
- A tela de manutenção já documenta que as senhas **não são exportáveis**.
- O export local também sugere preservação de `auth.users.id`, o que é importante para evitar quebrar FKs e referências cruzadas.

## Restrições reais da migração
1. Hashes/senhas atuais não podem ser reutilizados de forma suportada.
2. O sistema referencia `user_id` em múltiplas tabelas operacionais.
3. Trocar IDs de usuário elevaria muito o risco de inconsistência.
4. O endpoint público atual de reset **não é ideal** para campanha em massa sem endurecimento adicional.

## Estratégias consideradas

### Opção A — obrigar usuário a usar “Esqueci minha senha” após cutover
**Prós**
- simples de explicar;
- não exige import especial de `auth.users`.

**Contras**
- depende de o usuário iniciar a ação;
- gera pico de suporte no dia do cutover;
- pior experiência para usuários menos engajados;
- não garante cobertura rápida da base.

**Veredito:** não recomendada como estratégia principal.

### Opção B — criar usuários novos por Admin API e remapear todos os IDs
**Prós**
- usa apenas APIs suportadas.

**Contras**
- alto risco operacional;
- exige mapeamento `old_user_id -> new_user_id` em muitas tabelas;
- aumenta risco de inconsistência e rollback complexo.

**Veredito:** evitar, salvo impossibilidade absoluta de preservar `auth.users.id`.

### Opção C — preservar `auth.users.id` + senha placeholder + reset em massa
**Prós**
- mantém integridade referencial;
- reduz impacto sobre `profiles`, `user_roles`, `leads`, `contracts`, `tasks`, etc.;
- melhor UX do que depender do esquecimento espontâneo;
- rollback mais simples.

**Contras**
- exige operação controlada de import/auth seed;
- requer campanha de email bem preparada;
- precisa de hardening operacional do reset.

**Veredito:** **recomendação final**.

## Estratégia recomendada

### Fase 1 — Pré-cutover, sem produção
1. Exportar usuários e metadados do ambiente atual.
2. Preparar import no Supabase destino preservando:
   - `auth.users.id`
   - `email`
   - `phone`
   - `raw_user_meta_data`
   - `raw_app_meta_data`
   - flags de confirmação relevantes
3. Definir para cada usuário uma senha placeholder **não divulgada**.
   - Não usar senha temporária única compartilhada.
   - Preferir valor aleatório por usuário ou hash gerado em lote.
4. Importar também tabelas dependentes mantendo os mesmos `user_id`.

### Fase 2 — Hardening do reset antes do uso real
Antes de qualquer campanha em massa, endurecer o processo operacional de reset:
- não usar o endpoint público atual em modo “aberto” para disparo massivo;
- disparar links por processo operador/backend autenticado;
- limitar taxa de envio por lote;
- registrar sucesso/falha por usuário;
- mascarar erros para evitar enumeração de emails.

### Fase 3 — Comunicação ao usuário
Enviar comunicação em duas ondas:

#### Onda 1 — pré-aviso (24–72h antes da janela)
Conteúdo mínimo:
- data e janela da mudança;
- ação esperada do usuário;
- informar que será necessário redefinir a senha por segurança;
- canal oficial de suporte.

#### Onda 2 — instrução de acesso (durante/ao final do cutover)
Conteúdo mínimo:
- link oficial para redefinição;
- prazo de validade do link;
- orientação anti-phishing;
- passo a passo curto de login pós-reset.

### Fase 4 — Primeiro login pós-cutover
Comportamento recomendado:
- usuário recebe link de recovery;
- redefine a senha;
- autentica no novo Supabase;
- sessões antigas são tratadas como inválidas/encerradas.

## Fluxo operacional recomendado

### Lote de preparação
1. Congelar mudanças estruturais em auth na origem.
2. Gerar snapshot de `auth.users` + tabelas dependentes.
3. Validar contagem de usuários, emails confirmados e metadados.
4. Popular ambiente destino sem expor produção.

### Lote de reset
1. Gerar recovery link via Admin API no destino.
2. Enviar email transacional via Resend em lotes.
3. Registrar:
   - `user_id`
   - email
   - link gerado em timestamp controlado (não logar token completo em texto puro)
   - status do envio
   - retries
4. Reprocessar falhas transitórias.

### Lote de suporte assistido
Criar runbook de suporte para:
- email não recebido;
- link expirado;
- usuário sem acesso ao email original;
- contas com convites pendentes;
- usuários duplicados ou emails divergentes.

## Rollback operacional
### Antes do anúncio ao usuário
Se a validação falhar antes do disparo dos emails:
- abortar o lote;
- manter produção inalterada;
- corrigir o destino e repetir ensaio.

### Após envio de emails, mas antes do cutover efetivo
Se houver falha relevante:
- informar adiamento;
- manter DNS/aplicação na origem;
- invalidar comunicações erradas com novo aviso;
- regenerar links somente na nova janela.

### Após cutover
Manter rollback apenas se:
- autenticação estiver indisponível de forma generalizada;
- taxa de falha de recovery estiver acima do tolerável;
- houver inconsistência severa de `user_id`/perfil.

Se o rollback ocorrer, comunicar explicitamente a data e a nova janela. Não alternar ambientes silenciosamente.

## Riscos e mitigação
| Risco | Impacto | Mitigação |
|---|---|---|
| IDs de usuário mudarem | Muito alto | Preservar `auth.users.id` no destino |
| Campanha de reset gerar abuso | Alto | Processo operador/backend, rate limit e lotes |
| Endpoint público revelar emails | Alto | Não usar diretamente para campanha em massa |
| Links com domínio errado | Alto | Revisar `APP_URL`, Site URL e Redirect URLs antes do envio |
| Volume alto de suporte | Médio/alto | Comunicação em 2 ondas + FAQ + retries controlados |
| Sessões antigas persistirem | Médio | Forçar nova autenticação após cutover |

## Recomendação final
A recomendação final é **preservar os IDs dos usuários, sem migrar senhas, e executar reset de senha em massa de forma controlada e auditável**. Essa abordagem oferece o melhor equilíbrio entre:
- segurança;
- compatibilidade com o modelo atual de dados;
- reversibilidade;
- menor risco de corrupção de vínculos multi-tenant.

## O que NÃO fazer nesta fase
- Não executar reset em massa em produção ainda.
- Não apontar o frontend para o Supabase novo ainda.
- Não criar usuários com novos IDs se isso puder ser evitado.
- Não usar senha temporária compartilhada divulgada aos usuários.

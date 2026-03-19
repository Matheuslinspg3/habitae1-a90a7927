# MIGRATION_RISKS.md — Riscos Técnicos da Migração
> Gerado em: 2026-03-19

---

## 🔴 RISCOS CRÍTICOS (Bloqueadores)

### R1 — LOVABLE_API_KEY não portável
- **Impacto**: 6 Edge Functions param de funcionar
- **Funções afetadas**: `analyze-photo-quality`, `validate-document`, `contract-ai-fill`, `generate-contract-template`, `generate-ad-image`, `generate-ad-content`
- **Solução**: Refatorar cada função para usar Google AI API direta (`GOOGLE_AI_KEY_*` já configurados) ou OpenAI API (`OPENAI_IMAGE_API_KEY` já disponível)
- **Esforço**: ~4-8h de desenvolvimento
- **Status**: ⏳ Requer refatoração antes do cutover

### R2 — Senhas de auth.users não exportáveis via API
- **Impacto**: Todos os usuários perdem acesso após migração
- **Solução A**: Enviar email de reset de senha em massa após migração
- **Solução B**: Obter connection string e usar `pg_dump` da tabela `auth.users` (inclui `encrypted_password`)
- **Solução C**: Manter o projeto Lovable Cloud ativo temporariamente como proxy de autenticação
- **Esforço**: Solução A = 1h; Solução B = requer acesso que Lovable Cloud não fornece
- **Recomendação**: Solução A (reset em massa via Resend)

### R3 — URLs hardcoded em pg_cron jobs
- **Impacto**: Jobs de cleanup e sync não executam
- **Detalhes**: 2 jobs com URL `https://aiflfkkjitvsyszwdfga.supabase.co` e anon key hardcoded
- **Solução**: Recriar jobs com nova URL/key após importação
- **Esforço**: 15 min

### R4 — Trigger `trigger_push_on_notification` com fallback hardcoded
- **Impacto**: Push notifications podem falhar silenciosamente
- **Detalhes**: Tenta GUC settings primeiro, mas fallback aponta para projeto antigo
- **Solução**: Configurar GUC settings E atualizar a função para remover fallback
- **Esforço**: 15 min

---

## 🟡 RISCOS MODERADOS

### R5 — OAuth redirect URIs
- **Impacto**: Meta Ads e RD Station OAuth param de funcionar
- **Detalhes**: Redirect URIs apontam para `aiflfkkjitvsyszwdfga.supabase.co`
- **Solução**: Atualizar URIs nos consoles Meta Developer e RD Station
- **Esforço**: 30 min

### R6 — Webhook endpoints externos
- **Impacto**: Asaas billing, RD Station webhooks não entregam
- **Detalhes**: URLs de webhook cadastradas nos serviços externos apontam para projeto antigo
- **Solução**: Atualizar URLs em cada painel de serviço
- **Esforço**: 30 min

### R7 — Realtime não configurado automaticamente
- **Impacto**: `useMaintenanceMode` e notificações em tempo real param
- **Tabelas que precisam realtime**: `app_runtime_config`, `notifications`, `leads`, `appointments`
- **Solução**: Executar `ALTER PUBLICATION supabase_realtime ADD TABLE` para cada tabela
- **Esforço**: 15 min

### R8 — GUC settings não existem no novo banco
- **Impacto**: `trigger_push_on_notification` usa `current_setting('app.settings.supabase_url')` 
- **Solução**: `ALTER DATABASE postgres SET app.settings.supabase_url = '...';`
- **Esforço**: 5 min

### R9 — Edge Functions com `std/http/server.ts` (legacy imports)
- **Impacto**: Podem funcionar mas sem garantia de estabilidade long-term
- **Solução**: Migrar para `Deno.serve()` nativo (já feito em funções recentes)
- **Esforço**: ~2h para todas

### R10 — APP_URL secret precisa refletir novo domínio
- **Impacto**: Links em emails (invite, reset) apontam para domínio antigo
- **Solução**: Atualizar secret `APP_URL` para o novo domínio
- **Esforço**: 5 min

---

## 🟢 RISCOS BAIXOS

### R11 — Extensões não ativadas automaticamente
- **Detalhes**: `pg_cron`, `pg_net`, `pg_trgm` precisam ativação manual
- **Solução**: Ativar via SQL Editor antes de importar schema
- **Esforço**: 5 min

### R12 — Views não incluídas no DDL padrão
- **Detalhes**: `profiles_public` e `marketplace_properties_public` são views simples
- **Solução**: Exportar manualmente ou verificar se o DDL export já inclui
- **Esforço**: 5 min

### R13 — Dados de scrape_cache são transitórios
- **Detalhes**: Cache de scraping pode ser descartado
- **Solução**: Não exportar (opcional)
- **Esforço**: 0

### R14 — rd_station_webhook_logs grande (12.7 MB)
- **Detalhes**: Logs de webhook, não críticos para operação
- **Solução**: Exportar apenas registros recentes ou pular
- **Esforço**: 0

---

## ITENS NÃO PORTÁVEIS (RESUMO)

| Item | Substituição |
|------|-------------|
| `LOVABLE_API_KEY` | Google AI keys diretas (já possui GOOGLE_AI_KEY_1/2) |
| `ai.gateway.lovable.dev` | `https://generativelanguage.googleapis.com/v1beta/` ou OpenAI API |
| Hashes de senha (auth.users) | Reset em massa |
| pg_cron jobs (hardcoded) | Recriar com novos valores |
| Lovable Cloud UI (/backend) | Supabase Dashboard |
| Auto-deploy de Edge Functions | `supabase functions deploy` via CLI |

---

## TIMELINE ESTIMADA

| Fase | Duração | Detalhe |
|------|---------|---------|
| Preparação do destino | 2h | Projeto, extensões, secrets |
| Refatoração AI gateway | 4-8h | 6 Edge Functions |
| Exportação | 30 min | Via /manutencao |
| Importação | 1h | SQL + validação |
| Reconfiguração | 1h | OAuth, webhooks, cron, GUC |
| Testes | 2h | Fluxos críticos |
| Reset de senhas | 30 min | Email em massa |
| **Total estimado** | **11-15h** | Com janela de manutenção de ~2h |

---

## DECISÃO: MIGRAÇÃO É VIÁVEL? 

### ✅ SIM — com ressalvas:

1. **Banco de dados**: 100% exportável (schema + dados + policies)
2. **Edge Functions**: 64/70 portáveis imediatamente; 6 precisam refatoração (AI gateway)
3. **Secrets**: 39/40 portáveis
4. **Auth**: Estrutura portável, senhas requerem reset
5. **Integrações**: Todas portáveis com reconfiguração de URLs

### Bloqueadores que devem ser resolvidos ANTES do cutover:
1. Refatorar 6 funções do AI gateway Lovable → Google AI direto
2. Definir estratégia de reset de senhas (email em massa)
3. Preparar todos os secrets no destino

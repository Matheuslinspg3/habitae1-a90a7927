# Habitae — Contexto Completo do Projeto para IA

> Documento gerado em: 2026-03-14
> Objetivo: Fornecer contexto completo para que um assistente de IA entenda o estado atual, a arquitetura e os próximos passos do projeto.

---

## 🎯 O que é o Habitae

**Habitae** (anteriormente "Porta do Corretor") é um **ERP imobiliário SaaS** multi-tenant voltado para imobiliárias e corretores individuais no Brasil. O sistema gerencia todo o ciclo de vida de uma operação imobiliária: imóveis, leads (CRM), contratos, financeiro, marketing digital e automações.

**Modelo de negócio:** SaaS com planos (Starter trial 14 dias → planos pagos via billing). Cada cliente é uma `organization` com seus próprios dados isolados por RLS.

---

## 🏗️ Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui |
| **Backend** | Supabase (Postgres + Auth + Edge Functions Deno + Storage) via Lovable Cloud |
| **Estado** | TanStack Query (React Query) para cache/fetch |
| **Roteamento** | React Router v6 (SPA) |
| **PWA** | vite-plugin-pwa (offline-first, installable) |
| **Imagens** | Cloudinary (principal) + Cloudflare R2 (fallback/migração) |
| **Mapas** | Google Maps Embed API |
| **Push** | OneSignal |
| **Analytics** | Microsoft Clarity |
| **Billing** | Webhooks de gateway de pagamento externo |

---

## 📂 Estrutura de Pastas

```
src/
├── components/          # Componentes React organizados por domínio
│   ├── ui/              # shadcn/ui components (button, dialog, card, etc.)
│   ├── crm/             # CRM: Kanban, LeadCard, LeadDetails, importação
│   ├── properties/      # Imóveis: formulário, filtros, galeria, mapa
│   ├── financial/       # Financeiro: transações, faturas, comissões
│   ├── contracts/       # Contratos: formulário, detalhes, filtros
│   ├── ads/             # Meta Ads, RD Station, Gerador IA
│   ├── automations/     # Workflows automáticos
│   ├── dashboard/       # Cards, métricas, ações rápidas
│   ├── admin/           # Rotas protegidas admin
│   ├── developer/       # Painel developer (system health, uso IA, etc.)
│   ├── settings/        # Perfil, equipe, plano, suporte
│   ├── owners/          # Proprietários de imóveis
│   ├── marketplace/     # Vitrine pública entre imobiliárias
│   ├── integrations/    # Imobzi, portais XML, API keys
│   ├── schedule/        # Agenda: compromissos e tarefas
│   ├── layouts/         # AppLayout (sidebar + content)
│   └── app/             # App consumidor (PWA mobile)
├── contexts/            # AuthContext, DemoContext, ImportProgressContext
├── hooks/               # Custom hooks (useLeads, useProperties, useContracts, etc.)
├── pages/               # Páginas/rotas do app
├── lib/                 # Utilitários (imageUrl, viaCep, pdfProcessor, etc.)
├── types/               # TypeScript types
└── integrations/supabase/ # Client + Types auto-gerados

supabase/
├── functions/           # ~50 Edge Functions (Deno)
│   ├── billing-webhook/ # Processar pagamentos
│   ├── imobzi-import/   # Importação de imóveis do Imobzi
│   ├── meta-sync-leads/ # Sincronizar leads do Meta Ads
│   ├── generate-ad-*/   # Geração de anúncios com IA
│   ├── send-push/       # Push notifications via OneSignal
│   ├── r2-upload/       # Upload para Cloudflare R2
│   └── ...              # ~45 outras functions
└── config.toml          # Configuração do projeto Supabase
```

---

## 🗄️ Arquitetura de Dados (Tabelas Principais)

### Core
- **organizations** — Cada cliente (imobiliária ou corretor individual)
- **profiles** — Dados do usuário, vinculado a `organization_id`
- **user_roles** — Permissões (enum: developer, admin, sub_admin, leader, corretor, assistente)

### Imóveis
- **properties** — Imóveis com dados completos (localização, valores, características)
- **property_images** — Fotos com suporte a Cloudinary e R2
- **property_media** — Mídia auxiliar (Google Drive cache, etc.)
- **property_types** — Tipos de imóvel (apartamento, casa, etc.)
- **owners** — Proprietários vinculados a imóveis

### CRM
- **leads** — Leads com temperatura, estágio, corretor, origem
- **lead_stages** — Estágios do pipeline (customizáveis por org)
- **lead_types** — Tipos de lead
- **lead_interactions** — Timeline de interações (ligação, email, visita, WhatsApp)

### Financeiro
- **contracts** — Contratos de venda/locação
- **invoices** — Faturas (pendente, paga, vencida)
- **commissions** — Comissões por contrato/corretor
- **transactions/transaction_categories** — Receitas e despesas

### Marketing
- **ad_accounts** — Contas de anúncio (Meta, RD Station)
- **ad_entities** — Campanhas/conjuntos/anúncios sincronizados
- **ad_leads** — Leads capturados por anúncios
- **ad_insights_daily** — Métricas diárias (CPL, CPC, CTR)
- **anuncios_gerados** — Textos/imagens gerados por IA

### Marketplace
- **marketplace_properties** — Imóveis publicados na vitrine pública
- **marketplace_contact_access** — Controle de acesso a contatos

### Infra
- **subscriptions / subscription_plans** — Planos e assinaturas
- **billing_payments** — Pagamentos processados
- **notifications** — Sistema de notificações in-app + push
- **push_subscriptions** — Dispositivos registrados para push
- **support_tickets / ticket_messages** — Suporte ao cliente
- **import_runs / import_run_items** — Importações de dados (Imobzi, CSV)
- **activity_log / audit_logs** — Auditoria de ações

---

## 🔐 Segurança e Permissões (RBAC)

### Hierarquia de Roles
```
developer (sistema) > admin (dono) > sub_admin > leader > corretor > assistente (read-only)
```

### Regras Principais
- Dados isolados por `organization_id` via RLS em todas as tabelas
- `user_roles` em tabela separada (nunca no profile) — previne privilege escalation
- Funções `SECURITY DEFINER` para checks de role sem recursão RLS
- `admin_allowlist` para acesso developer ao sistema
- Assistente é estritamente read-only

### Controle de Acesso por Módulo
| Módulo | developer | admin | sub_admin | leader | corretor | assistente |
|--------|-----------|-------|-----------|--------|----------|------------|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ |
| Imóveis | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ |
| CRM | ✅ | ✅ | ✅ | ✅ | ✅ (só seus) | 👁️ |
| Financeiro+Contratos | ✅ | ✅ | ✅ | ✅ | ✅ | 👁️ |
| Marketplace | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Automações | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Administração+Atividades | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Integrações | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Developer | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 🧭 Navegação Atual (Sidebar Consolidada)

Recentemente reorganizamos a sidebar de ~16 itens em 6 grupos para **~10 itens em 3 grupos**:

```
Menu (todos):
  Dashboard, Imóveis, Proprietários, CRM, Agenda,
  Marketplace, Financeiro (com aba Contratos),
  Anúncios (Meta Ads + RD Station + Gerador IA em abas),
  Automações (developer/leader)

Gestão (admin+):
  Administração (Equipe + Atividades + Cargos + Histórico em abas),
  Integrações

Sistema:
  Configurações

Developer (developer only):
  Developer
```

### Consolidações realizadas:
1. **Anúncios** (`/anuncios`) — Unified: Meta Ads, RD Station, Gerador IA em abas/seções
2. **Financeiro** (`/financeiro`) — Absorveu Contratos como aba
3. **Administração** (`/administracao`) — Absorveu Atividades como aba
4. Rotas legadas redirecionam: `/contratos` → `/financeiro?tab=contracts`, `/rdstation` → `/anuncios?section=rdstation`, etc.

---

## 🧩 Módulos Detalhados

### 1. Dashboard (`/dashboard`)
- Cards de resumo (imóveis, leads, contratos, saldo)
- Ações rápidas, tarefas do dia, compromissos próximos
- Funil de conversão, pipeline, alertas de inatividade
- Métricas do marketplace, banner PWA

### 2. Imóveis (`/imoveis`)
- CRUD completo com formulário em abas (Básico, Valores, Localização, Características, Descrição, Fotos)
- Busca unificada, filtros avançados, buscas salvas
- Views: Cards, Lista, Mapa
- Seleção em massa, import via PDF, QR Code
- Landing page pública por imóvel com editor visual
- Detecção automática de duplicatas

### 3. CRM (`/crm`)
- Kanban com drag-and-drop por estágio
- Timeline de interações (ligação, email, visita, WhatsApp)
- Importação (CSV wizard com field mapping, API, Imobzi)
- Lead scoring, atribuição a corretor, ações rápidas
- Leads inativos com reativação

### 4. Financeiro (`/financeiro`) — inclui Contratos
- Abas: Transações, Faturas, Comissões, Contratos
- Fluxo de caixa com gráfico
- Contratos: venda/locação, comissões, documentos, preenchimento IA

### 5. Anúncios (`/anuncios`) — consolidado
- **Meta Ads**: Lista de anúncios, inbox de leads, estatísticas (CPL, CPC, CTR), configuração OAuth
- **RD Station**: Configuração, webhook, OAuth, sincronização de leads, estatísticas
- **Gerador IA**: Gerar textos (Portal, Instagram, WhatsApp) e imagens para anúncios

### 6. Marketplace (`/marketplace`)
- Vitrine pública de imóveis entre imobiliárias
- Filtros avançados, contato com corretor, detalhes

### 7. Agenda (`/agenda`)
- Compromissos (visitas, reuniões) e tarefas com calendário
- Exportação .ics

### 8. Automações (`/automacoes`) — developer/leader
- Workflows: trigger → condição → ação
- Templates prontos, histórico de execuções, lead scoring

### 9. Administração (`/administracao`) — admin+
- Abas: Equipe (métricas por membro), Leads sem corretor, Cargos customizados, Atividades, Histórico

### 10. Integrações (`/integracoes`) — admin+
- Imobzi (API key, importação com scraping de fotos)
- Portais XML (ZAP, OLX, VivaReal)
- Histórico de sincronizações

### 11. App Consumidor (`/app/*`)
- PWA mobile-first para busca de imóveis
- Onboarding, busca, favoritos, perfil
- Rota separada do ERP principal

---

## ⚡ Edge Functions (~50 funções)

Categorias principais:
- **Billing**: `billing-webhook`, `billing`
- **Importação**: `imobzi-import`, `imobzi-process`, `imobzi-list`, `crm-import-leads`
- **Marketing**: `meta-sync-leads`, `meta-sync-entities`, `rd-station-sync-leads`, `rd-station-webhook`
- **IA**: `generate-ad-content`, `generate-ad-image`, `generate-landing-content`, `contract-ai-fill`, `extract-property-pdf`, `test-ai-connection`
- **Mídia**: `cloudinary-sign`, `r2-upload`, `r2-presign`, `cache-drive-image`, `migrate-to-r2`
- **Auth/Org**: `platform-signup`, `accept-invite`, `send-invite-email`, `manage-member`
- **Notificações**: `send-push`, `notifications-register-device`, `notifications-test`
- **Infra**: `toggle-maintenance-mode`, `export-database`, `storage-metrics`, `cloudflare-purge-cache`

---

## 📊 Estado Atual — O que Já Funciona

### ✅ Completo e em produção
- Autenticação (email + convite por link)
- CRUD de imóveis com fotos (Cloudinary)
- CRM com Kanban, pipeline customizável
- Importação de imóveis via Imobzi (com scraping de fotos)
- Importação de leads via CSV (wizard com field mapping)
- Contratos (venda/locação) com comissões
- Financeiro (transações, faturas, comissões)
- Marketplace entre imobiliárias
- Agenda (compromissos + tarefas)
- Meta Ads (OAuth, sync anúncios, inbox leads, métricas)
- RD Station (webhook, OAuth, sync leads, estatísticas)
- Gerador de anúncios com IA (texto + imagem)
- Push notifications (OneSignal)
- PWA installável
- Sistema de planos/assinaturas com trial
- Painel developer (system health, uso IA, gestão global)
- RBAC completo com 6 níveis
- Activity log / auditoria
- Cargos customizados por organização
- App consumidor mobile (PWA)

### 🔧 Funcional mas com melhorias pendentes
- Automações (wizard funciona, mas execução é básica)
- Landing pages de imóveis (editor visual básico)
- Detecção de duplicatas (baseada em título/endereço, poderia usar pHash de fotos)
- Google Ads (placeholder no menu, não implementado)

---

## 🚀 Para Onde Queremos Ir (Roadmap)

### Curto prazo
1. **Polir UX** — Animações, micro-interações, skeleton loaders consistentes
2. **Google Ads** — Integração similar ao Meta Ads
3. **Automações avançadas** — Execução real de workflows (hoje é configuração)
4. **Relatórios** — Dashboards analíticos mais robustos (PDF export)
5. **WhatsApp Business API** — Envio de mensagens automatizado

### Médio prazo
6. **App consumidor completo** — Notificações de novos imóveis, filtros salvos, chat com corretor
7. **Multi-idioma** — i18n (PT-BR é o único hoje)
8. **Assinatura eletrônica** — Contratos digitais
9. **Portal do proprietário** — Área restrita para donos de imóveis acompanharem

### Longo prazo
10. **IA conversacional** — Chatbot para leads no site/WhatsApp
11. **Análise preditiva** — Previsão de conversão de leads
12. **Marketplace nacional** — Escalar vitrine para todo Brasil
13. **API pública** — Para integrações de terceiros

---

## 🔑 Padrões de Código

### Frontend
- **Componentes**: Functional components com hooks, shadcn/ui como base
- **Estado**: TanStack Query para server state, useState/useContext para UI state
- **Estilo**: Tailwind CSS com tokens semânticos do design system (HSL em index.css)
- **Rotas**: Lazy loading com `React.lazy()` + `Suspense`
- **Formulários**: React Hook Form (em alguns) + controlled components
- **Tipagem**: TypeScript strict, tipos do Supabase auto-gerados

### Backend (Edge Functions)
- **Runtime**: Deno (Supabase Edge Functions)
- **Auth**: Verificação de JWT via `supabase.auth.getUser()`
- **Padrão**: CORS headers + try/catch + JSON responses
- **Segurança**: RLS no banco + verificação de role nas functions sensíveis

### Convenções
- Nomes de tabelas/colunas em **snake_case** (inglês)
- Labels/UI em **português brasileiro**
- Hooks custom por domínio: `useLeads`, `useProperties`, `useContracts`
- Componentes organizados por feature, não por tipo
- Arquivo `types.ts` do Supabase é **read-only** (auto-gerado)

---

## ⚠️ Limitações e Débitos Técnicos Conhecidos

1. **Alguns componentes muito grandes** — AppSidebar, PropertyForm, Financial poderiam ser mais modulares
2. **Testes limitados** — Existem alguns testes básicos mas cobertura é baixa
3. **Automações** — Wizard configura mas não executa workflows reais
4. **Performance** — Algumas queries poderiam usar paginação server-side
5. **i18n** — Hardcoded em PT-BR, sem framework de internacionalização
6. **Mobile** — Responsivo funciona, mas experiência mobile poderia ser mais nativa

---

## 📋 Instruções para o Assistente IA

Ao trabalhar neste projeto:

1. **Sempre use tokens semânticos** do design system (nunca cores hardcoded)
2. **Nunca edite** `src/integrations/supabase/types.ts` ou `client.ts` — são auto-gerados
3. **Use migrations** para qualquer alteração no banco de dados
4. **RLS é obrigatório** em todas as tabelas com dados de usuário
5. **Roles ficam em `user_roles`** — nunca na tabela profiles
6. **Chame o backend de "Lovable Cloud"** — nunca "Supabase" para o usuário
7. **Edge Functions** deployam automaticamente — não precisa instruir deploy manual
8. **Lazy loading** para todas as páginas
9. **PT-BR** para toda UI/labels, inglês para código/variáveis
10. **Importe o supabase client** de `@/integrations/supabase/client`

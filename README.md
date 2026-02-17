# Habitae — ERP Imobiliário

Sistema completo de gestão imobiliária: imóveis, leads (CRM), contratos, financeiro, marketplace e automações.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui |
| Backend | Lovable Cloud (Supabase) — Postgres, Auth, Edge Functions, Storage |
| Maps | Google Maps Embed API |
| Imagens | Cloudinary + Cloudflare R2 (fallback) |
| PWA | vite-plugin-pwa (offline-first, installable) |

## Arquitetura

```
[Browser SPA — React/Vite]
  ├─ Supabase JS Client (auth + queries + realtime)
  ├─ Edge Functions (billing, imports, geocode, PDF, etc.)
  └─ Google Maps Embed iframe
        ↓
[Lovable Cloud]
  ├─ Postgres + RLS policies
  ├─ Auth (email + invite flow)
  ├─ Edge Functions (Deno)
  └─ Storage (Cloudinary / R2)
```

## Módulos principais

- **Dashboard** — Métricas, funil, tarefas do dia, alertas de inatividade
- **Imóveis** — CRUD completo, fotos, mapa, QR code, landing page, busca avançada
- **CRM / Leads** — Kanban, pipeline customizável, importação CSV/API, lead scoring
- **Contratos** — Venda, aluguel, comissões, documentos
- **Financeiro** — Transações, faturas, comissões, fluxo de caixa
- **Marketplace** — Vitrine pública entre imobiliárias
- **Automações** — Workflows configuráveis para follow-up e notificações
- **Agenda** — Compromissos e tarefas com calendário
- **Integrações** — Imobzi, portais XML, API keys
- **App Mobile** — PWA com bottom nav, pull-to-refresh, onboarding

## Ambientes

| Ambiente | URL | Descrição |
|----------|-----|-----------|
| Test | Preview do Lovable Editor | Desenvolvimento e testes |
| Production | `https://habitae1.lovable.app` | Usuários finais |

Dados são isolados entre ambientes. Deploy via **Publish** no editor.

## Variáveis de ambiente

Veja [`docs/ENV_EXAMPLE.md`](docs/ENV_EXAMPLE.md) para lista completa.

## Documentação operacional

- [`docs/RELEASE_RUNBOOK.md`](docs/RELEASE_RUNBOOK.md) — Deploy, rollback e resposta a incidentes
- [`docs/CONTINGENCY_PLAN.md`](docs/CONTINGENCY_PLAN.md) — Plano de contingência de storage

## Licença

Proprietário — todos os direitos reservados.

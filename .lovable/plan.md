

# Plano: Modo de Manutenção / Migração

## Arquitetura

```text
┌─────────────────────────────────────────────────┐
│  Developer Dashboard (MaintenanceCard)          │
│  → Botão ativar/desativar + modal confirmação   │
│  → Chama Edge Function toggle-maintenance-mode  │
└──────────────────────┬──────────────────────────┘
                       │
         ┌─────────────▼──────────────┐
         │  Edge Function             │
         │  toggle-maintenance-mode   │
         │  - valida JWT (getClaims)  │
         │  - verifica is_system_admin│
         │  - UPDATE app_runtime_cfg  │
         │  - INSERT maintenance_audit│
         └─────────────┬──────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  Tabela app_runtime_config          │
    │  (single row, RLS: select público,  │
    │   update bloqueado no client)       │
    ├─────────────────────────────────────┤
    │  Tabela maintenance_audit_log       │
    │  (registra ativações/desativações)  │
    └─────────────────────────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  Frontend Guards                    │
    │  - useMaintenanceMode() hook        │
    │  - MaintenanceGuard wrapper no App  │
    │  - /manutencao página pública       │
    │  - Auth.tsx bloqueia login          │
    └─────────────────────────────────────┘
```

## 1. Migration SQL

Criar tabela `app_runtime_config` (single-row) e `maintenance_audit_log`:

- `app_runtime_config`: `id` (text PK default 'singleton'), `maintenance_mode` boolean, `maintenance_message` text, `maintenance_started_at` timestamptz, `maintenance_started_by` uuid, `updated_at` timestamptz. RLS: SELECT para todos (anon+authenticated), sem INSERT/UPDATE/DELETE via client (somente Edge Function com service_role).
- `maintenance_audit_log`: `id` uuid, `action` text, `performed_by` uuid, `performed_at` timestamptz, `previous_value` boolean, `new_value` boolean, `maintenance_message` text, `ip_address` text, `user_agent` text. RLS: SELECT para system_admin only, sem INSERT via client.
- Inserir row singleton com maintenance_mode=false e mensagem padrão.

## 2. Edge Function: `toggle-maintenance-mode`

- `verify_jwt = false` no config.toml
- Valida JWT via `getClaims()`
- Verifica `is_system_admin()` via query com service_role client
- Recebe body: `{ action: 'activate' | 'deactivate', message?: string }`
- Atualiza `app_runtime_config`
- Insere registro em `maintenance_audit_log`
- Retorna estado final

## 3. Hook: `useMaintenanceMode()`

- Query na tabela `app_runtime_config` (SELECT público, sem auth necessário)
- `staleTime: 30s`, refetch on window focus
- Retorna `{ isMaintenanceMode, maintenanceMessage, isLoading }`
- Se query falhar → assume manutenção ativa (fail-secure)

## 4. Componente: `MaintenanceGuard`

- Wrapa toda a app no `App.tsx`, dentro do `AuthProvider`
- Se `maintenance_mode=true`:
  - Verifica se user é system_admin (via `is_system_admin()` RPC ou check email na `admin_allowlist`)
  - Se não for admin → redireciona para `/manutencao`
  - Se for admin → renderiza children normalmente
- Se `maintenance_mode=false` → renderiza children normalmente

## 5. Página `/manutencao`

- Rota pública, simples, sem sidebar/nav
- Mostra ícone de manutenção, mensagem do banco, e "Tente novamente em alguns minutos"
- Botão "Tentar novamente" que re-verifica

## 6. Bloqueio na página de Login (`Auth.tsx`)

- Consulta `useMaintenanceMode()` 
- Se ativo: desabilita formulário de login, mostra banner de manutenção

## 7. Painel Developer: `MaintenanceCard`

- Card no grid do DeveloperDashboard (ao lado de SystemHealthCard, etc.)
- Mostra status, mensagem, quem ativou, quando
- Botão ativar/desativar com modal de confirmação (digitar "MIGRACAO")
- Campo editável para mensagem
- Chama Edge Function

## 8. Bloqueio backend (RLS adicional)

- Criar função SQL `is_maintenance_blocked()` que retorna true se maintenance_mode=true E o user NÃO é system_admin
- Adicionar políticas RLS restritivas nas tabelas críticas (properties, leads, contracts, etc.) para INSERT/UPDATE/DELETE que negam quando `is_maintenance_blocked()` retorna true
- Isso garante bloqueio real no banco mesmo se frontend for burlado

## Arquivos criados/alterados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabelas + RLS + função |
| `supabase/config.toml` | Adicionar `[functions.toggle-maintenance-mode]` |
| `supabase/functions/toggle-maintenance-mode/index.ts` | Edge Function |
| `src/hooks/useMaintenanceMode.ts` | Hook |
| `src/components/MaintenanceGuard.tsx` | Guard wrapper |
| `src/components/developer/MaintenanceCard.tsx` | Painel Developer |
| `src/pages/Maintenance.tsx` | Página de manutenção |
| `src/pages/developer/DeveloperDashboard.tsx` | Adicionar MaintenanceCard |
| `src/App.tsx` | Adicionar rota `/manutencao` + MaintenanceGuard |
| `src/pages/Auth.tsx` | Bloquear login durante manutenção |
| `src/components/ProtectedRoute.tsx` | Check maintenance |

## Ponto de atenção

- A lista de admins autorizados durante manutenção usa a tabela `admin_allowlist` já existente no projeto (verificada via `is_system_admin()`). Você precisa garantir que seus emails de admin estão nessa tabela.


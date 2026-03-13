

## Análise Completa da Estrutura Atual — Porta do Corretor

### Arquitetura de Membros e Controle de Acesso

**Hierarquia de Cargos (RBAC via `user_roles`):**
```text
developer (sistema) → admin (dono) → sub_admin (sub-dono) → leader → corretor → assistente (somente leitura)
```

**Tabelas envolvidas:**
- `user_roles`: define cargo (role) por `user_id` — sem vínculo com organização
- `profiles`: vincula usuário à organização via `organization_id`
- `organizations`: dados da imobiliária (nome, CNPJ, logo, endereço, invite_code)
- `organization_invites`: convites pendentes com email, cargo, expiração
- `activity_log`: auditoria de ações (criação, edição, atribuição de leads, etc.)

---

### O que já existe hoje

| Funcionalidade | Onde | Quem acessa |
|---|---|---|
| **Ver membros da equipe** | Configurações → Equipe | admin, sub_admin, leader, developer |
| **Alterar cargo de membro** | Configurações → Equipe + Administração → Equipe | admin (limitado), developer (total) |
| **Convidar membro** (link + email) | Configurações → Equipe → TeamInviteSection | admin, leader, developer |
| **Distribuir leads sem corretor** | Administração → Leads | admin+ |
| **Ver leads/tarefas por membro** | Administração → Equipe (cards com contagem) | admin+ |
| **Log de atividades** (quem fez o quê) | /atividades — filtro por corretor, entidade, ação | admin+ |
| **Gestão de roles (developer)** | Painel Developer → RolesTab | developer only |
| **Remover/resetar senha de usuário** | Painel Developer → UsersTab (edge function `admin-users`) | developer only |

---

### O que NÃO existe ainda (lacunas identificadas)

1. **Dashboard centralizado de membros** com visão completa: último login, status online/offline, total de ações no período
2. **Histórico de entrada/saída** — quem entrou na organização e quando, quem saiu (não há registro de remoção de membros)
3. **Criação de cargos personalizados** — os cargos são fixos no enum `app_role`, não há como a imobiliária criar cargos customizados
4. **Controle granular de acesso por módulo** — hoje o acesso é por cargo fixo (corretor vê X, admin vê Y), não há permissões por módulo configuráveis
5. **Remoção de membro da equipe pelo admin** — admin não pode remover um corretor da organização (só developer pode deletar via edge function)
6. **Relatório de produtividade por membro** — quantos leads atendidos, imóveis cadastrados, contratos fechados por período

---

### Segurança atual

- **RLS multi-tenant**: todas as queries filtram por `organization_id`
- **Funções SECURITY DEFINER**: `has_role()`, `is_org_admin()`, `is_org_manager_or_above()`, `is_system_admin()`
- **Route guards**: `ManagerRoute` (admin+), `AdminRoute` (developer), `DeveloperRoute` (developer/leader)
- **Sidebar condicional**: seções "Gestão" e "Automações" só aparecem para cargos adequados
- **Corretor**: só vê leads atribuídos a ele, sem acesso a Equipe/Integrações/Administração/Atividades

---

### Resumo

O sistema tem uma base sólida de RBAC com 6 cargos fixos, controle por RLS, auditoria de ações e gestão de equipe básica. As principais lacunas são: não há dashboard de membros rico (último acesso, produtividade), não há registro de entrada/saída de membros, os cargos são fixos (sem customização pela imobiliária), e o admin não pode remover membros — só convidar.

Quer que eu implemente alguma dessas melhorias?


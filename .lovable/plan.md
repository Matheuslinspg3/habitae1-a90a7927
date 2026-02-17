

# Plano de Correções da Auditoria

## O que será feito

### 1. Dados-semente para novas organizações (Crítico)
Novas organizações são criadas sem estágios de lead, tipos de lead ou tipos de imóvel. Isso deixa o Kanban do CRM vazio e impede classificação de propriedades.

**Correção:** Inserir registros-modelo no banco de dados:
- 8 estágios de lead (Novo, Contato Inicial, Visita Agendada, Proposta, Negociação, Fechado Ganho, Fechado Perdido, Descartado)
- 6 tipos de lead (Comprador, Locatário, Investidor, Vendedor, Proprietário, Indicação)
- 12 tipos de imóvel (Apartamento, Casa, Terreno, Sala Comercial, Loja, Galpão, Cobertura, Studio, Kitnet, Chácara, Fazenda, Flat)

### 2. Corrigir políticas RLS duplicadas em `user_roles`
Existem políticas de INSERT e DELETE duplicadas que podem causar conflitos.

**Correção:** Remover as políticas antigas redundantes (`Dev or leader can insert/delete roles`), mantendo apenas as mais recentes.

### 3. Unificar lógica de mudança de cargo
Na página de Configurações, o `handleChangeRole` usa `.update()`, enquanto a Administração usa `delete + insert`. Isso causa inconsistência.

**Correção:** Alterar `Settings.tsx` para usar `delete + insert`, igual ao padrão da Administração.

### 4. Corrigir warnings de ref nos logos
Os componentes `HabitaeLogo` e `LogoMark` geram avisos no console por não suportarem refs.

**Correção:** Adicionar `React.forwardRef` nos dois componentes.

### 5. Adicionar "Esqueci minha senha" na página de login
Usuários que esquecem a senha ficam sem acesso. Como a plataforma é fechada (sem criar conta publicamente), apenas o link de recuperação será adicionado.

**Correção:** Adicionar link "Esqueci minha senha" na página `/auth` que envia email de reset via `resetPasswordForEmail`.

### 6. Remover cast `as any` do `occurred_at`
O campo `occurred_at` já existe nos tipos gerados, mas o código ainda usa cast inseguro.

**Correção:** Remover `(interaction as any).occurred_at` e usar o campo tipado diretamente.

---

## Detalhes técnicos

### Migração SQL (Etapas 1 e 2)

```text
-- Dados-semente: lead_stages
INSERT INTO lead_stages (name, color, position, is_default, is_win, is_loss)
VALUES
  ('Novo', '#3b82f6', 0, true, false, false),
  ('Contato Inicial', '#8b5cf6', 1, true, false, false),
  ('Visita Agendada', '#f59e0b', 2, true, false, false),
  ('Proposta Enviada', '#06b6d4', 3, true, false, false),
  ('Negociação', '#ec4899', 4, true, false, false),
  ('Fechado Ganho', '#22c55e', 5, true, true, false),
  ('Fechado Perdido', '#ef4444', 6, true, false, true),
  ('Descartado', '#6b7280', 7, true, false, true);

-- Dados-semente: lead_types
INSERT INTO lead_types (name, color, is_default)
VALUES
  ('Comprador', '#3b82f6', true),
  ('Locatário', '#8b5cf6', true),
  ('Investidor', '#f59e0b', true),
  ('Vendedor', '#22c55e', true),
  ('Proprietário', '#06b6d4', true),
  ('Indicação', '#ec4899', true);

-- Dados-semente: property_types
INSERT INTO property_types (name, is_default)
VALUES
  ('Apartamento', true), ('Casa', true), ('Terreno', true),
  ('Sala Comercial', true), ('Loja', true), ('Galpão', true),
  ('Cobertura', true), ('Studio', true), ('Kitnet', true),
  ('Chácara', true), ('Fazenda', true), ('Flat', true);

-- Limpar RLS duplicadas
DROP POLICY IF EXISTS "Dev or leader can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Dev or leader can delete roles" ON user_roles;
```

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/pages/Settings.tsx` | `handleChangeRole`: trocar `.update()` por `delete + insert` |
| `src/pages/Auth.tsx` | Adicionar link "Esqueci minha senha" com modal/inline de reset |
| `src/components/HabitaeLogo.tsx` | Adicionar `forwardRef` em `LogoMark` e `HabitaeLogo` |
| `src/components/crm/LeadInteractionTimeline.tsx` | Remover `as any` do `occurred_at` |
| Migração SQL | Seed data + remoção de políticas duplicadas |


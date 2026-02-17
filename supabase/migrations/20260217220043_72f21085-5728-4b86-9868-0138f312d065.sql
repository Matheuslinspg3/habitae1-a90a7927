
-- Dados-semente: lead_stages (modelo para novas organizações)
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
INSERT INTO lead_types (name, color, position, is_default)
VALUES
  ('Comprador', '#3b82f6', 0, true),
  ('Locatário', '#8b5cf6', 1, true),
  ('Investidor', '#f59e0b', 2, true),
  ('Vendedor', '#22c55e', 3, true),
  ('Proprietário', '#06b6d4', 4, true),
  ('Indicação', '#ec4899', 5, true);

-- Dados-semente: property_types
INSERT INTO property_types (name, is_default)
VALUES
  ('Apartamento', true), ('Casa', true), ('Terreno', true),
  ('Sala Comercial', true), ('Loja', true), ('Galpão', true),
  ('Cobertura', true), ('Studio', true), ('Kitnet', true),
  ('Chácara', true), ('Fazenda', true), ('Flat', true);

-- Limpar políticas RLS duplicadas em user_roles
DROP POLICY IF EXISTS "Dev or leader can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Dev or leader can delete roles" ON user_roles;

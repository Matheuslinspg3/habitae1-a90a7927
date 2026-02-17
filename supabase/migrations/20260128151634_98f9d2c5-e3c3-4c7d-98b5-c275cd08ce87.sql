-- Inserir tipos de lead padrão (Frio, Morno, Quente)
INSERT INTO public.lead_types (name, color, is_default, organization_id)
VALUES 
  ('Frio', '#60a5fa', true, NULL),
  ('Morno', '#fbbf24', true, NULL),
  ('Quente', '#ef4444', true, NULL)
ON CONFLICT DO NOTHING;
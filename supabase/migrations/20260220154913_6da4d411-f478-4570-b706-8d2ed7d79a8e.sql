ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_temperature_check;
ALTER TABLE leads ADD CONSTRAINT leads_temperature_check
  CHECK (temperature IN ('frio', 'morno', 'quente', 'prioridade'));
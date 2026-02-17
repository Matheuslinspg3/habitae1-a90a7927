
-- Add area_useful column for "Área Útil"
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS area_useful numeric;

-- Add sale_price_financed column for "Valor Financiado" (sale_price becomes "Valor à Vista")
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS sale_price_financed numeric;

-- Make title nullable since we'll auto-generate it
ALTER TABLE public.properties ALTER COLUMN title DROP NOT NULL;

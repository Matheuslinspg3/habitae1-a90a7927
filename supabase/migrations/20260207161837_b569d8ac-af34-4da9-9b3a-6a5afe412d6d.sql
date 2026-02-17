
-- Adicionar campos de interesse na tabela leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS transaction_interest TEXT,
  ADD COLUMN IF NOT EXISTS min_bedrooms INTEGER,
  ADD COLUMN IF NOT EXISTS max_bedrooms INTEGER,
  ADD COLUMN IF NOT EXISTS min_area NUMERIC,
  ADD COLUMN IF NOT EXISTS max_area NUMERIC,
  ADD COLUMN IF NOT EXISTS preferred_neighborhoods TEXT[],
  ADD COLUMN IF NOT EXISTS preferred_cities TEXT[],
  ADD COLUMN IF NOT EXISTS additional_requirements TEXT;

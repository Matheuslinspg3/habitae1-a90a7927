
-- Add bathroom and parking preferences to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS min_bathrooms integer,
  ADD COLUMN IF NOT EXISTS max_bathrooms integer,
  ADD COLUMN IF NOT EXISTS min_parking integer,
  ADD COLUMN IF NOT EXISTS max_parking integer;

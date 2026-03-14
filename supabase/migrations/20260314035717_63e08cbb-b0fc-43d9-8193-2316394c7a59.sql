ALTER TABLE public.anuncios_gerados 
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tone text DEFAULT 'formal';

CREATE INDEX IF NOT EXISTS idx_anuncios_gerados_org_created 
  ON public.anuncios_gerados(organization_id, created_at DESC);
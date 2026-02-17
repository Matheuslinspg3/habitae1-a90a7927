-- Fix scrape_cache RLS to be more restrictive but still functional
-- Since scrape_cache is a shared cache used by edge functions, we keep it permissive for authenticated users
-- But clarify that the WARN is intentional for this shared cache scenario
-- The cache is read/written by edge functions using service role, so authenticated policies are minimal
-- Drop overly permissive policies and create more specific ones

DROP POLICY IF EXISTS "Authenticated users can insert scrape cache" ON public.scrape_cache;
DROP POLICY IF EXISTS "Authenticated users can update scrape cache" ON public.scrape_cache;

-- Only allow service role (edge functions) to manage cache via INSERT/UPDATE
-- Authenticated users can only read
CREATE POLICY "Service role manages scrape cache"
  ON public.scrape_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- Relaxar política SELECT do marketplace para fase de desenvolvimento
DROP POLICY IF EXISTS "Subscribers can view marketplace properties" ON public.marketplace_properties;

CREATE POLICY "Anyone can view marketplace properties"
ON public.marketplace_properties
FOR SELECT
USING (true);
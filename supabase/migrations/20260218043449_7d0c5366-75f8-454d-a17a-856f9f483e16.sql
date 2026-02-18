-- Allow all authenticated users to view available marketplace properties
CREATE POLICY "Authenticated users can view available marketplace properties"
ON public.marketplace_properties
FOR SELECT
USING (status = 'disponivel' AND auth.role() = 'authenticated');

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Org members can view own marketplace properties" ON public.marketplace_properties;
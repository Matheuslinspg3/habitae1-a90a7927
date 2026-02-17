-- Allow authenticated users to insert/upsert their properties into the marketplace
CREATE POLICY "Users can insert marketplace properties"
  ON public.marketplace_properties
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update marketplace properties"
  ON public.marketplace_properties
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete marketplace properties"
  ON public.marketplace_properties
  FOR DELETE
  TO authenticated
  USING (true);
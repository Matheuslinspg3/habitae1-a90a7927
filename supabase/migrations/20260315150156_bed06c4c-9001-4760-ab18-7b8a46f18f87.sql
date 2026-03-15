
-- Create brand-assets storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload brand assets for their org
CREATE POLICY "Authenticated users can upload brand assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brand-assets');

CREATE POLICY "Anyone can view brand assets"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'brand-assets');

CREATE POLICY "Authenticated users can update brand assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'brand-assets');

CREATE POLICY "Authenticated users can delete brand assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'brand-assets');

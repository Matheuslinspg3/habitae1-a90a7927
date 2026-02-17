
-- Create storage bucket for PDF uploads (temp processing)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf-imports', 'pdf-imports', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload PDFs
CREATE POLICY "Authenticated users can upload PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pdf-imports' AND auth.role() = 'authenticated');

-- Allow authenticated users to read their own uploads
CREATE POLICY "Authenticated users can read own PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'pdf-imports' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated users can delete own PDFs"
ON storage.objects FOR DELETE
USING (bucket_id = 'pdf-imports' AND auth.role() = 'authenticated');

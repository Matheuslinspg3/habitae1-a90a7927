
-- A3: Fix PDF storage isolation - restrict by owner (auth.uid())
-- Current policies allow any authenticated user to read/delete any PDF

-- Drop insecure policies
DROP POLICY IF EXISTS "Authenticated users can read own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own PDFs" ON storage.objects;

-- Recreate with proper owner isolation
CREATE POLICY "Users can read own PDFs"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'pdf-imports'
  AND auth.role() = 'authenticated'
  AND owner = auth.uid()
);

CREATE POLICY "Users can upload own PDFs"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'pdf-imports'
  AND auth.role() = 'authenticated'
  AND owner = auth.uid()
);

CREATE POLICY "Users can delete own PDFs"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'pdf-imports'
  AND auth.role() = 'authenticated'
  AND owner = auth.uid()
);

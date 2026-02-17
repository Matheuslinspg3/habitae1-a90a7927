
-- 1. Move pg_trgm extension from public to extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- 2. Fix storage deletion policy: restrict to organization members only
-- The property-images bucket uses paths like: org_id/property_id/filename
DROP POLICY IF EXISTS "Users can delete their property images" ON storage.objects;

CREATE POLICY "Org members can delete their property images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'property-images'
  AND auth.uid() IS NOT NULL
  AND (
    -- Images are stored at org_id/... path structure
    -- Check that user belongs to the org whose folder the image is in
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.organization_id::text = (storage.foldername(name))[1]
    )
  )
);

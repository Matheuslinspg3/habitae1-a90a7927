
-- Add R2 storage columns to property_images
ALTER TABLE public.property_images 
  ADD COLUMN IF NOT EXISTS r2_key_full TEXT,
  ADD COLUMN IF NOT EXISTS r2_key_thumb TEXT,
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'cloudinary';

-- Index for quick lookups by storage provider
CREATE INDEX IF NOT EXISTS idx_property_images_storage_provider 
  ON public.property_images (storage_provider) 
  WHERE storage_provider = 'r2';

COMMENT ON COLUMN public.property_images.r2_key_full IS 'R2 object key for full-size variant (max 1920w, webp)';
COMMENT ON COLUMN public.property_images.r2_key_thumb IS 'R2 object key for thumbnail variant (400w, webp)';
COMMENT ON COLUMN public.property_images.storage_provider IS 'Primary storage: r2 or cloudinary';


-- Add columns for progressive Drive image caching
ALTER TABLE public.property_images
  ADD COLUMN IF NOT EXISTS cached_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS drive_file_id text,
  ADD COLUMN IF NOT EXISTS cache_status text DEFAULT 'pending';

-- Index for quick lookups by drive_file_id
CREATE INDEX IF NOT EXISTS idx_property_images_drive_file_id ON public.property_images(drive_file_id) WHERE drive_file_id IS NOT NULL;

-- Index for cache worker queries
CREATE INDEX IF NOT EXISTS idx_property_images_cache_status ON public.property_images(cache_status) WHERE cache_status = 'pending';

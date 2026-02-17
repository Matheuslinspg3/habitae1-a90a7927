
-- Add perceptual hash column for duplicate image detection
ALTER TABLE public.property_media
ADD COLUMN phash text;

-- Index for fast lookups within same organization
CREATE INDEX idx_property_media_phash ON public.property_media (organization_id, phash)
WHERE phash IS NOT NULL;

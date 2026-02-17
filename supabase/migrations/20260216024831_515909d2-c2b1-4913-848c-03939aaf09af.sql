
-- Add perceptual hash column to property_images for duplicate detection
ALTER TABLE public.property_images
ADD COLUMN phash text;

-- Index for fast lookups via join with properties
CREATE INDEX idx_property_images_phash ON public.property_images (phash)
WHERE phash IS NOT NULL;

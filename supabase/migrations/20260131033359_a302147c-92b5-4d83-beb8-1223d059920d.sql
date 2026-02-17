-- ============================================
-- MIGRATION: Fix Imobzi Import - Add traceability and property_media
-- ============================================

-- 1. Add source tracking columns to properties table
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS source_provider TEXT,
ADD COLUMN IF NOT EXISTS source_property_id TEXT,
ADD COLUMN IF NOT EXISTS source_key_id TEXT,
ADD COLUMN IF NOT EXISTS source_code TEXT,
ADD COLUMN IF NOT EXISTS source_status TEXT,
ADD COLUMN IF NOT EXISTS raw_payload JSONB;

-- 2. Add unique index for idempotent imports (prevent duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_source_unique 
ON public.properties(organization_id, source_provider, source_property_id) 
WHERE source_provider IS NOT NULL AND source_property_id IS NOT NULL;

-- 3. Add index for provider filtering
CREATE INDEX IF NOT EXISTS idx_properties_source_provider 
ON public.properties(source_provider) WHERE source_provider IS NOT NULL;

-- 4. Create property_media table for normalized media storage
CREATE TABLE IF NOT EXISTS public.property_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Media type
  kind TEXT NOT NULL CHECK (kind IN ('cover', 'cover_private', 'gallery', 'floor_plan', 'floor_plan_secondary', 'video')),
  
  -- URLs
  original_url TEXT NOT NULL,
  stored_url TEXT,
  
  -- Storage info
  storage_provider TEXT,
  storage_path TEXT,
  
  -- Deduplication
  checksum TEXT,
  file_size_bytes BIGINT,
  
  -- Metadata
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  
  -- Order and flags
  display_order INTEGER DEFAULT 0,
  is_processed BOOLEAN DEFAULT FALSE,
  processing_error TEXT,
  
  -- Source tracking
  source_media_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Indexes for property_media
CREATE INDEX IF NOT EXISTS idx_property_media_property ON public.property_media(property_id);
CREATE INDEX IF NOT EXISTS idx_property_media_unprocessed ON public.property_media(is_processed) WHERE is_processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_property_media_checksum ON public.property_media(checksum) WHERE checksum IS NOT NULL;

-- 6. Enable RLS on property_media
ALTER TABLE public.property_media ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for property_media
CREATE POLICY "Users can view media from their organization" ON public.property_media
FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert media in their organization" ON public.property_media
FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update media in their organization" ON public.property_media
FOR UPDATE USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete media in their organization" ON public.property_media
FOR DELETE USING (organization_id = get_user_organization_id());

-- 8. Trigger for updated_at on property_media
CREATE TRIGGER update_property_media_updated_at
BEFORE UPDATE ON public.property_media
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
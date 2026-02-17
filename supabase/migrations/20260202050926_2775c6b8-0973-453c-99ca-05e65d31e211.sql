-- Create table for Imobzi integration settings per organization
CREATE TABLE public.imobzi_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL UNIQUE,
  api_key_encrypted TEXT,
  smart_list TEXT DEFAULT 'available',
  sync_mode TEXT DEFAULT 'create_update',
  scraping_enabled BOOLEAN DEFAULT true,
  scraping_min_photos INTEGER DEFAULT 5,
  scraper_concurrency INTEGER DEFAULT 2,
  scrape_cache_ttl_hours INTEGER DEFAULT 24,
  last_sync_at TIMESTAMPTZ,
  last_cursor TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.imobzi_settings ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only manage their organization's settings
CREATE POLICY "Users can view their org imobzi settings"
  ON public.imobzi_settings FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert their org imobzi settings"
  ON public.imobzi_settings FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update their org imobzi settings"
  ON public.imobzi_settings FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete their org imobzi settings"
  ON public.imobzi_settings FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Create table for scrape cache (global, not per-org since same URLs yield same results)
CREATE TABLE public.scrape_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_hash TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  images JSONB,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'success',
  error_message TEXT
);

-- Indexes for scrape cache
CREATE INDEX idx_scrape_cache_url_hash ON public.scrape_cache(url_hash);
CREATE INDEX idx_scrape_cache_expires ON public.scrape_cache(expires_at);

-- Enable RLS on scrape_cache (allow all authenticated users to read/write - it's shared cache)
ALTER TABLE public.scrape_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read scrape cache"
  ON public.scrape_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert scrape cache"
  ON public.scrape_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update scrape cache"
  ON public.scrape_cache FOR UPDATE
  TO authenticated
  USING (true);

-- Add source tracking columns to property_images
ALTER TABLE public.property_images 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS scraped_from_url TEXT;

-- Add scrape-related columns to import_runs
ALTER TABLE public.import_runs
ADD COLUMN IF NOT EXISTS images_scraped INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS scrape_failed INTEGER DEFAULT 0;

-- Add scrape tracking to import_run_items
ALTER TABLE public.import_run_items
ADD COLUMN IF NOT EXISTS scrape_attempted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS scrape_images_found INTEGER DEFAULT 0;

-- Create trigger for imobzi_settings updated_at
CREATE TRIGGER update_imobzi_settings_updated_at
  BEFORE UPDATE ON public.imobzi_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
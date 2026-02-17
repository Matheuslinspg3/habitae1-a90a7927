
-- Add geocoding metadata columns to properties table
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS geocode_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS geocode_precision text,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz,
  ADD COLUMN IF NOT EXISTS geocode_provider text,
  ADD COLUMN IF NOT EXISTS geocode_hash text,
  ADD COLUMN IF NOT EXISTS geocode_error text;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_properties_geocode_status ON public.properties (geocode_status);
CREATE INDEX IF NOT EXISTS idx_properties_latlng ON public.properties (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_geocode_hash ON public.properties (geocode_hash) WHERE geocode_hash IS NOT NULL;

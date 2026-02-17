
-- Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA public;

-- Create nearby properties search function (Phase 3)
CREATE OR REPLACE FUNCTION public.search_properties_nearby(
  p_organization_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_km double precision DEFAULT 5.0,
  p_limit integer DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  property_code character varying,
  title character varying,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  sale_price numeric,
  rent_price numeric,
  cover_image_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    p.id,
    p.property_code,
    p.title,
    p.latitude,
    p.longitude,
    (6371 * acos(
      cos(radians(p_latitude)) * cos(radians(p.latitude)) *
      cos(radians(p.longitude) - radians(p_longitude)) +
      sin(radians(p_latitude)) * sin(radians(p.latitude))
    )) as distance_km,
    p.sale_price,
    p.rent_price,
    (SELECT pi.url FROM property_images pi WHERE pi.property_id = p.id AND pi.is_cover = true LIMIT 1) as cover_image_url
  FROM properties p
  WHERE p.organization_id = p_organization_id
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND (6371 * acos(
      cos(radians(p_latitude)) * cos(radians(p.latitude)) *
      cos(radians(p.longitude) - radians(p_longitude)) +
      sin(radians(p_latitude)) * sin(radians(p.latitude))
    )) <= p_radius_km
  ORDER BY distance_km
  LIMIT p_limit;
$function$;

-- Create saved searches table (Phase 4)
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  notify_new_matches boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved searches"
  ON public.saved_searches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create saved searches"
  ON public.saved_searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved searches"
  ON public.saved_searches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved searches"
  ON public.saved_searches FOR DELETE
  USING (auth.uid() = user_id);

-- Index for geolocation
CREATE INDEX IF NOT EXISTS idx_properties_lat_lng ON properties (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

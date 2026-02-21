
-- 1. Create property_share_links table
CREATE TABLE public.property_share_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES auth.users(id),
  slug VARCHAR(20) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast slug lookup
CREATE INDEX idx_property_share_links_slug ON public.property_share_links(slug) WHERE active = true;
CREATE INDEX idx_property_share_links_property ON public.property_share_links(property_id);

-- Enable RLS
ALTER TABLE public.property_share_links ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can manage their own links
CREATE POLICY "Users can view own share links"
  ON public.property_share_links
  FOR SELECT
  USING (broker_id = auth.uid());

CREATE POLICY "Users can insert own share links"
  ON public.property_share_links
  FOR INSERT
  WITH CHECK (broker_id = auth.uid());

CREATE POLICY "Users can update own share links"
  ON public.property_share_links
  FOR UPDATE
  USING (broker_id = auth.uid());

CREATE POLICY "Users can delete own share links"
  ON public.property_share_links
  FOR DELETE
  USING (broker_id = auth.uid());

-- 2. Secure RPC: get_public_property_by_slug
-- Returns ONLY public-safe fields. NEVER returns owner data, internal notes, etc.
CREATE OR REPLACE FUNCTION public.get_public_property_by_slug(p_slug text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link RECORD;
  v_property RECORD;
  v_broker RECORD;
  v_images json;
  v_media json;
  v_property_type text;
  result json;
BEGIN
  -- 1. Find active, non-expired link
  SELECT * INTO v_link
  FROM property_share_links
  WHERE slug = p_slug
    AND active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF v_link IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Get ONLY public-safe property fields (NO owner data, NO internal notes)
  SELECT
    p.id,
    p.title,
    p.description,
    p.property_type_id,
    p.transaction_type,
    p.status,
    p.sale_price,
    p.rent_price,
    p.condominium_fee,
    p.iptu,
    p.bedrooms,
    p.suites,
    p.bathrooms,
    p.parking_spots,
    p.area_total,
    p.area_built,
    p.amenities,
    p.address_neighborhood,
    p.address_city,
    p.address_state,
    p.youtube_url,
    p.property_condition,
    p.floor
  INTO v_property
  FROM properties p
  WHERE p.id = v_link.property_id;

  IF v_property IS NULL THEN
    RETURN NULL;
  END IF;

  -- 3. Get property type name
  SELECT name INTO v_property_type
  FROM property_types
  WHERE id = v_property.property_type_id;

  -- 4. Get broker contact info (the person who shared, NOT the owner)
  SELECT
    pr.full_name,
    pr.phone,
    pr.avatar_url
  INTO v_broker
  FROM profiles pr
  WHERE pr.user_id = v_link.broker_id;

  -- 5. Get property images (public URLs only)
  SELECT COALESCE(json_agg(json_build_object(
    'id', pi.id,
    'url', pi.url,
    'is_cover', pi.is_cover,
    'display_order', pi.display_order
  ) ORDER BY pi.display_order ASC NULLS LAST), '[]'::json)
  INTO v_images
  FROM property_images pi
  WHERE pi.property_id = v_link.property_id;

  -- 6. Get property media (fallback)
  SELECT COALESCE(json_agg(json_build_object(
    'id', pm.id,
    'url', COALESCE(pm.stored_url, pm.original_url),
    'display_order', pm.display_order
  ) ORDER BY pm.display_order ASC NULLS LAST), '[]'::json)
  INTO v_media
  FROM property_media pm
  WHERE pm.property_id = v_link.property_id;

  -- 7. Build safe response
  result := json_build_object(
    'property', json_build_object(
      'id', v_property.id,
      'title', v_property.title,
      'description', v_property.description,
      'property_type', v_property_type,
      'transaction_type', v_property.transaction_type,
      'status', v_property.status,
      'sale_price', v_property.sale_price,
      'rent_price', v_property.rent_price,
      'condominium_fee', v_property.condominium_fee,
      'iptu', v_property.iptu,
      'bedrooms', v_property.bedrooms,
      'suites', v_property.suites,
      'bathrooms', v_property.bathrooms,
      'parking_spots', v_property.parking_spots,
      'area_total', v_property.area_total,
      'area_built', v_property.area_built,
      'amenities', v_property.amenities,
      'neighborhood', v_property.address_neighborhood,
      'city', v_property.address_city,
      'state', v_property.address_state,
      'youtube_url', v_property.youtube_url,
      'property_condition', v_property.property_condition,
      'floor', v_property.floor
    ),
    'images', v_images,
    'media', v_media,
    'broker', json_build_object(
      'name', v_broker.full_name,
      'phone', v_broker.phone,
      'avatar_url', v_broker.avatar_url
    )
  );

  RETURN result;
END;
$$;

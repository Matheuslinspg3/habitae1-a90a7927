
DROP FUNCTION IF EXISTS public.get_public_property_images(uuid);

CREATE OR REPLACE FUNCTION public.get_public_property_images(p_property_id uuid)
RETURNS TABLE (
  id uuid,
  url text,
  is_cover boolean,
  display_order integer,
  image_type public.property_image_type,
  source text,
  r2_key_full text,
  r2_key_thumb text,
  storage_provider text,
  cached_thumbnail_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pi.id, pi.url, pi.is_cover, pi.display_order, pi.image_type, pi.source,
         pi.r2_key_full, pi.r2_key_thumb, pi.storage_provider, pi.cached_thumbnail_url
  FROM property_images pi
  INNER JOIN properties p ON p.id = pi.property_id
  WHERE pi.property_id = p_property_id AND p.status = 'disponivel'
  ORDER BY pi.display_order ASC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_property_images(uuid) TO anon, authenticated;

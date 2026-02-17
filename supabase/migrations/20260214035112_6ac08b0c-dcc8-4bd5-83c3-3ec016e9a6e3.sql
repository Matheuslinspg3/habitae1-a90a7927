
-- Function to get property images for public landing pages
CREATE OR REPLACE FUNCTION public.get_public_property_images(p_property_id uuid)
RETURNS TABLE (
  id uuid,
  url text,
  is_cover boolean,
  display_order integer,
  image_type public.property_image_type,
  source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pi.id, pi.url, pi.is_cover, pi.display_order, pi.image_type, pi.source
  FROM property_images pi
  INNER JOIN properties p ON p.id = pi.property_id
  WHERE pi.property_id = p_property_id AND p.status = 'disponivel'
  ORDER BY pi.display_order ASC NULLS LAST;
$$;

-- Function to get property media for public landing pages (fallback)
CREATE OR REPLACE FUNCTION public.get_public_property_media(p_property_id uuid)
RETURNS TABLE (
  id uuid,
  stored_url text,
  original_url text,
  display_order integer,
  kind text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pm.id, pm.stored_url, pm.original_url, pm.display_order, pm.kind
  FROM property_media pm
  INNER JOIN properties p ON p.id = pm.property_id
  WHERE pm.property_id = p_property_id AND p.status = 'disponivel'
  ORDER BY pm.display_order ASC NULLS LAST;
$$;

-- Function to get a property type by ID (public)
CREATE OR REPLACE FUNCTION public.get_property_type_name(p_type_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name FROM property_types WHERE id = p_type_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_property_images(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_property_media(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_property_type_name(uuid) TO anon, authenticated;

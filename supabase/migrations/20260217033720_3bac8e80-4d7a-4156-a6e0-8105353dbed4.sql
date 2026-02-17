
-- Drop and recreate with extensions in search_path
DROP FUNCTION IF EXISTS public.search_properties_fuzzy(uuid, text, integer);

CREATE OR REPLACE FUNCTION public.search_properties_fuzzy(
  p_organization_id uuid,
  p_query text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  title character varying,
  property_code character varying,
  address_neighborhood character varying,
  address_city character varying,
  similarity_score real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.property_code,
    p.address_neighborhood,
    p.address_city,
    GREATEST(
      similarity(LOWER(p.title::text), LOWER(p_query)),
      similarity(LOWER(COALESCE(p.address_neighborhood::text, '')), LOWER(p_query)),
      similarity(LOWER(COALESCE(p.address_city::text, '')), LOWER(p_query))
    ) as similarity_score
  FROM properties p
  WHERE p.organization_id = p_organization_id
    AND (
      similarity(LOWER(p.title::text), LOWER(p_query)) > 0.2
      OR similarity(LOWER(COALESCE(p.address_neighborhood::text, '')), LOWER(p_query)) > 0.2
      OR similarity(LOWER(COALESCE(p.address_city::text, '')), LOWER(p_query)) > 0.2
    )
  ORDER BY similarity_score DESC
  LIMIT p_limit;
END;
$function$;

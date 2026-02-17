
CREATE OR REPLACE FUNCTION public.search_properties_advanced(
  p_organization_id uuid,
  p_search_text text DEFAULT NULL,
  p_property_code text DEFAULT NULL,
  p_transaction_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_property_type_id uuid DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_bedrooms integer DEFAULT NULL,
  p_neighborhood text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_min_area numeric DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_min_suites integer DEFAULT NULL,
  p_min_parking integer DEFAULT NULL,
  p_max_area numeric DEFAULT NULL,
  p_min_condominium numeric DEFAULT NULL,
  p_max_condominium numeric DEFAULT NULL,
  p_amenities text[] DEFAULT NULL,
  p_property_condition text DEFAULT NULL,
  p_max_beach_distance integer DEFAULT NULL,
  p_launch_stage text DEFAULT NULL
)
RETURNS TABLE(
  id uuid, property_code character varying, title character varying, description text,
  address_city character varying, address_neighborhood character varying, address_state character varying,
  sale_price numeric, rent_price numeric, bedrooms integer, bathrooms integer, parking_spots integer,
  area_total numeric, area_built numeric, status property_status, transaction_type transaction_type,
  property_type_id uuid, cover_image_url text, created_at timestamp with time zone, updated_at timestamp with time zone
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT 
    p.id, p.property_code, p.title, p.description,
    p.address_city, p.address_neighborhood, p.address_state,
    p.sale_price, p.rent_price, p.bedrooms, p.bathrooms, p.parking_spots,
    p.area_total, p.area_built, p.status, p.transaction_type, p.property_type_id,
    (SELECT pi.url FROM property_images pi WHERE pi.property_id = p.id AND pi.is_cover = true LIMIT 1) as cover_image_url,
    p.created_at, p.updated_at
  FROM properties p
  WHERE p.organization_id = p_organization_id
    AND (p_search_text IS NULL 
      OR p.title ILIKE '%' || p_search_text || '%'
      OR p.address_street ILIKE '%' || p_search_text || '%'
      OR p.address_city ILIKE '%' || p_search_text || '%'
      OR p.address_neighborhood ILIKE '%' || p_search_text || '%'
      OR p.property_code ILIKE '%' || p_search_text || '%')
    AND (p_property_code IS NULL OR p.property_code ILIKE p_property_code || '%')
    AND (p_transaction_type IS NULL OR p_transaction_type = 'all'
      OR p.transaction_type::text = p_transaction_type
      OR (p_transaction_type IN ('venda', 'aluguel') AND p.transaction_type = 'ambos'))
    AND (p_status IS NULL OR p_status = 'all' OR p.status::text = p_status)
    AND (p_property_type_id IS NULL OR p.property_type_id = p_property_type_id)
    AND (p_min_price IS NULL OR p.sale_price >= p_min_price OR p.rent_price >= p_min_price)
    AND (p_max_price IS NULL OR p.sale_price <= p_max_price OR p.rent_price <= p_max_price)
    AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
    AND (p_neighborhood IS NULL OR p.address_neighborhood ILIKE '%' || p_neighborhood || '%')
    AND (p_city IS NULL OR p.address_city ILIKE '%' || p_city || '%')
    AND (p_min_area IS NULL OR COALESCE(p.area_total, p.area_built, 0) >= p_min_area)
    -- New filters
    AND (p_min_suites IS NULL OR p.suites >= p_min_suites)
    AND (p_min_parking IS NULL OR p.parking_spots >= p_min_parking)
    AND (p_max_area IS NULL OR COALESCE(p.area_total, p.area_built, 0) <= p_max_area)
    AND (p_min_condominium IS NULL OR p.condominium_fee >= p_min_condominium)
    AND (p_max_condominium IS NULL OR p.condominium_fee <= p_max_condominium)
    AND (p_amenities IS NULL OR p.amenities @> p_amenities)
    AND (p_property_condition IS NULL OR p.property_condition::text = p_property_condition)
    AND (p_max_beach_distance IS NULL OR (p.beach_distance_meters IS NOT NULL AND p.beach_distance_meters <= p_max_beach_distance))
    AND (p_launch_stage IS NULL OR p.launch_stage::text = p_launch_stage)
  ORDER BY p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$function$;

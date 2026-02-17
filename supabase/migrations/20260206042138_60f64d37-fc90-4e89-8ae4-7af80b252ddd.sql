-- 1. Create RLS policy for public access to available properties
-- First, drop any existing conflicting policies
DROP POLICY IF EXISTS "Public properties are viewable by everyone" ON properties;

-- Create policy for public read access to available properties
CREATE POLICY "Public properties are viewable by everyone"
ON properties FOR SELECT
TO anon, authenticated
USING (
  status = 'disponivel'
);

-- 2. Create advanced search RPC function
CREATE OR REPLACE FUNCTION search_properties_advanced(
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
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  property_code varchar,
  title varchar,
  description text,
  address_city varchar,
  address_neighborhood varchar,
  address_state varchar,
  sale_price numeric,
  rent_price numeric,
  bedrooms integer,
  bathrooms integer,
  parking_spots integer,
  area_total numeric,
  area_built numeric,
  status property_status,
  transaction_type transaction_type,
  property_type_id uuid,
  cover_image_url text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.property_code,
    p.title,
    p.description,
    p.address_city,
    p.address_neighborhood,
    p.address_state,
    p.sale_price,
    p.rent_price,
    p.bedrooms,
    p.bathrooms,
    p.parking_spots,
    p.area_total,
    p.area_built,
    p.status,
    p.transaction_type,
    p.property_type_id,
    (SELECT pi.url FROM property_images pi WHERE pi.property_id = p.id AND pi.is_cover = true LIMIT 1) as cover_image_url,
    p.created_at,
    p.updated_at
  FROM properties p
  WHERE p.organization_id = p_organization_id
    -- Text search (title, address, code)
    AND (
      p_search_text IS NULL 
      OR p.title ILIKE '%' || p_search_text || '%'
      OR p.address_street ILIKE '%' || p_search_text || '%'
      OR p.address_city ILIKE '%' || p_search_text || '%'
      OR p.address_neighborhood ILIKE '%' || p_search_text || '%'
      OR p.property_code ILIKE '%' || p_search_text || '%'
    )
    -- Property code filter
    AND (p_property_code IS NULL OR p.property_code ILIKE p_property_code || '%')
    -- Transaction type filter
    AND (
      p_transaction_type IS NULL 
      OR p_transaction_type = 'all'
      OR p.transaction_type::text = p_transaction_type
      OR (p_transaction_type IN ('venda', 'aluguel') AND p.transaction_type = 'ambos')
    )
    -- Status filter
    AND (p_status IS NULL OR p_status = 'all' OR p.status::text = p_status)
    -- Property type filter
    AND (p_property_type_id IS NULL OR p.property_type_id = p_property_type_id)
    -- Price range (considers both sale and rent prices)
    AND (
      p_min_price IS NULL 
      OR p.sale_price >= p_min_price 
      OR p.rent_price >= p_min_price
    )
    AND (
      p_max_price IS NULL 
      OR p.sale_price <= p_max_price 
      OR p.rent_price <= p_max_price
    )
    -- Bedrooms filter
    AND (p_min_bedrooms IS NULL OR p.bedrooms >= p_min_bedrooms)
    -- Neighborhood filter
    AND (p_neighborhood IS NULL OR p.address_neighborhood ILIKE '%' || p_neighborhood || '%')
    -- City filter
    AND (p_city IS NULL OR p.address_city ILIKE '%' || p_city || '%')
    -- Area filter
    AND (p_min_area IS NULL OR COALESCE(p.area_total, p.area_built, 0) >= p_min_area)
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- 3. Create function to get distinct neighborhoods for filters
CREATE OR REPLACE FUNCTION get_property_neighborhoods(p_organization_id uuid)
RETURNS TABLE (neighborhood text, city text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(address_neighborhood, 'Não informado') as neighborhood,
    COALESCE(address_city, 'Não informado') as city,
    COUNT(*) as count
  FROM properties
  WHERE organization_id = p_organization_id
    AND address_neighborhood IS NOT NULL
    AND address_neighborhood != ''
  GROUP BY address_neighborhood, address_city
  ORDER BY count DESC, neighborhood ASC;
$$;

-- 4. Create function to get distinct cities for filters
CREATE OR REPLACE FUNCTION get_property_cities(p_organization_id uuid)
RETURNS TABLE (city text, state text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(address_city, 'Não informado') as city,
    COALESCE(address_state, '') as state,
    COUNT(*) as count
  FROM properties
  WHERE organization_id = p_organization_id
    AND address_city IS NOT NULL
    AND address_city != ''
  GROUP BY address_city, address_state
  ORDER BY count DESC, city ASC;
$$;
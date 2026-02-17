
-- Remove the anon policy that exposes all columns
DROP POLICY IF EXISTS "Public can view available properties via view" ON public.properties;

-- Drop the view (we'll use a function instead)
DROP VIEW IF EXISTS public.properties_public_landing;

-- Create a SECURITY DEFINER function that returns only safe columns
-- This avoids needing any anon RLS policy on properties
CREATE OR REPLACE FUNCTION public.get_public_property(p_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  property_type_id uuid,
  transaction_type public.transaction_type,
  status public.property_status,
  sale_price numeric,
  rent_price numeric,
  condominium_fee numeric,
  iptu numeric,
  iptu_monthly numeric,
  bedrooms integer,
  suites integer,
  bathrooms integer,
  parking_spots integer,
  area_total numeric,
  area_built numeric,
  area_useful numeric,
  floor integer,
  amenities text[],
  featured boolean,
  youtube_url text,
  development_name text,
  property_condition public.property_condition,
  launch_stage public.launch_stage,
  payment_options text[],
  address_neighborhood text,
  address_city text,
  address_state text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz,
  updated_at timestamptz,
  organization_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id, p.title, p.description, p.property_type_id, p.transaction_type,
    p.status, p.sale_price, p.rent_price, p.condominium_fee, p.iptu, p.iptu_monthly,
    p.bedrooms, p.suites, p.bathrooms, p.parking_spots,
    p.area_total, p.area_built, p.area_useful, p.floor,
    p.amenities, p.featured, p.youtube_url, p.development_name,
    p.property_condition, p.launch_stage, p.payment_options,
    p.address_neighborhood, p.address_city, p.address_state,
    p.latitude, p.longitude, p.created_at, p.updated_at, p.organization_id
  FROM properties p
  WHERE p.id = p_id AND p.status = 'disponivel';
$$;

-- Grant execute to anon so unauthenticated users can call it
GRANT EXECUTE ON FUNCTION public.get_public_property(uuid) TO anon, authenticated;

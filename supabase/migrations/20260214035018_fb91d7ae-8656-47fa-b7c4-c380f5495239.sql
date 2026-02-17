
-- Fix SECURITY DEFINER view by recreating with SECURITY INVOKER
DROP VIEW IF EXISTS public.properties_public_landing;

CREATE VIEW public.properties_public_landing
WITH (security_invoker = true) AS
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
  p.iptu_monthly,
  p.bedrooms,
  p.suites,
  p.bathrooms,
  p.parking_spots,
  p.area_total,
  p.area_built,
  p.area_useful,
  p.floor,
  p.amenities,
  p.featured,
  p.youtube_url,
  p.development_name,
  p.property_condition,
  p.launch_stage,
  p.payment_options,
  p.address_neighborhood,
  p.address_city,
  p.address_state,
  p.latitude,
  p.longitude,
  p.created_at,
  p.updated_at,
  p.organization_id
FROM public.properties p
WHERE p.status = 'disponivel';

-- Grant access
GRANT SELECT ON public.properties_public_landing TO anon, authenticated;

-- Re-add a public RLS policy on properties for the view to work with anon
-- This policy allows anon to SELECT only available properties (the view further restricts columns)
CREATE POLICY "Public can view available properties via view"
ON public.properties
FOR SELECT
TO anon
USING (status = 'disponivel');

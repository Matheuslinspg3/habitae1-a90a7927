
-- Step 1: Drop the overly permissive public SELECT policy on properties
DROP POLICY "Public properties are viewable by everyone" ON properties;

-- Step 2: Create a safe public view that excludes sensitive business data
CREATE OR REPLACE VIEW public.properties_public_landing AS
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
  -- Only neighborhood/city/state - NOT full street address
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

-- Step 3: Grant access to the view for anon and authenticated roles
GRANT SELECT ON public.properties_public_landing TO anon, authenticated;

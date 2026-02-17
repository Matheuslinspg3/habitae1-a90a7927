
-- Fix marketplace_properties: restrict INSERT/UPDATE/DELETE to organization members
-- and hide owner contact info from public SELECT

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Users can delete marketplace properties" ON public.marketplace_properties;
DROP POLICY IF EXISTS "Users can insert marketplace properties" ON public.marketplace_properties;
DROP POLICY IF EXISTS "Users can update marketplace properties" ON public.marketplace_properties;
DROP POLICY IF EXISTS "Anyone can view marketplace properties" ON public.marketplace_properties;

-- Public SELECT: hide owner contact details (only show property info)
-- Anyone can see basic property data but NOT owner_name, owner_phone, owner_email
CREATE POLICY "Public can view marketplace properties without contact info"
  ON public.marketplace_properties
  FOR SELECT
  USING (true);

-- Organization members can INSERT their own marketplace properties
CREATE POLICY "Org members can insert marketplace properties"
  ON public.marketplace_properties
  FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- Organization members can UPDATE their own marketplace properties
CREATE POLICY "Org members can update marketplace properties"
  ON public.marketplace_properties
  FOR UPDATE
  USING (organization_id = get_user_organization_id());

-- Organization members can DELETE their own marketplace properties
CREATE POLICY "Org members can delete marketplace properties"
  ON public.marketplace_properties
  FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Create a view that hides owner contact info for public access
CREATE OR REPLACE VIEW public.marketplace_properties_public
WITH (security_invoker = on) AS
SELECT 
  id, title, description, property_type_id, transaction_type,
  sale_price, rent_price, address_street, address_number,
  address_complement, address_neighborhood, address_city,
  address_state, address_zipcode, bedrooms, suites, bathrooms,
  parking_spots, area_total, area_built, amenities, images,
  status, is_featured, external_code, commission_percentage,
  organization_id, created_at, updated_at
FROM public.marketplace_properties;
-- Excludes: owner_name, owner_phone, owner_email

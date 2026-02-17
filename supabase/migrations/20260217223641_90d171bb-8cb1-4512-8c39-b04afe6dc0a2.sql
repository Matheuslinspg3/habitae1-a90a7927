-- Fix profiles_public: require authentication
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public WITH (security_invoker = true) AS
SELECT id, user_id, full_name, avatar_url, organization_id, onboarding_completed, created_at, updated_at
FROM profiles;

-- Fix marketplace_properties_public: remove sensitive owner data
DROP VIEW IF EXISTS public.marketplace_properties_public;
CREATE VIEW public.marketplace_properties_public WITH (security_invoker = true) AS
SELECT id, title, description, property_type_id, transaction_type,
  sale_price, rent_price, address_street, address_number, address_complement,
  address_neighborhood, address_city, address_state, address_zipcode,
  bedrooms, suites, bathrooms, parking_spots, area_total, area_built,
  amenities, images, status, is_featured, external_code,
  organization_id, created_at, updated_at
FROM marketplace_properties;

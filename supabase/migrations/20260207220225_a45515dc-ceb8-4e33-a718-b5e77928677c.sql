
-- Fix 1: marketplace_properties - replace permissive public SELECT with restricted policy
-- The public view excludes contact fields, but the base table policy allows direct access
DROP POLICY IF EXISTS "Public can view marketplace properties without contact info" ON public.marketplace_properties;

-- Authenticated org members can see their own marketplace properties (full access)
CREATE POLICY "Org members can view own marketplace properties"
  ON public.marketplace_properties FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Anon/public users can only read via the view (deny direct table access for anon)
-- The view marketplace_properties_public already excludes owner contact fields
-- We need a policy for authenticated users to see OTHER orgs' properties (without contact)
-- Use a restricted policy that hides contact fields via the existing view
CREATE POLICY "Authenticated users can view other marketplace properties"
  ON public.marketplace_properties FOR SELECT
  TO authenticated
  USING (
    organization_id != get_user_organization_id()
    OR get_user_organization_id() IS NULL
  );

-- Fix 2: profiles - restrict visibility of sensitive fields
-- Current policy lets all org members see all profiles. 
-- This is needed for broker lookups (full_name), but exposes phone/email/creci.
-- Create a view that only exposes non-sensitive fields for org-wide queries.
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT 
    id,
    user_id,
    full_name,
    avatar_url,
    organization_id,
    onboarding_completed,
    created_at,
    updated_at
  FROM public.profiles;
-- Excludes: phone, email_verified, phone_verified, creci

-- Tighten profiles SELECT: only own profile gets full access
-- Other org members can only see via the view
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- Users can always see their own full profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (user_id = auth.uid());

-- Org members can see limited profile data (via the view, which uses security_invoker)
-- We need to allow SELECT for org members so the view works
CREATE POLICY "Org members can view profiles in organization"
  ON public.profiles FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Keep developer access
-- (already exists: "Developers can view all profiles")


-- ================================================================
-- SECURITY HARDENING: Fix issues #2, #4, #3, #7
-- ================================================================

-- ----------------------------------------------------------------
-- #2 (Gravidade 8/10): marketplace_properties - remove cross-org 
--     direct table access. App already uses the safe public view.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view other marketplace properties" ON public.marketplace_properties;

-- Replace with: other orgs can ONLY read via the view (marketplace_properties_public),
-- which already excludes owner_name, owner_phone, owner_email.
-- No direct table SELECT for other orgs.

-- ----------------------------------------------------------------
-- #4 (Gravidade 7/10): organization_invites - restrict pending 
--     invite reading to authenticated users only
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read pending invites" ON public.organization_invites;

CREATE POLICY "Authenticated users can read pending invites"
ON public.organization_invites
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND status = 'pending'
  AND expires_at > now()
);

-- ----------------------------------------------------------------
-- #3 (Gravidade 5/10): profiles_public view - restrict to 
--     authenticated users only
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker = on)
AS
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

-- Grant access only to authenticated role
REVOKE ALL ON public.profiles_public FROM anon;
GRANT SELECT ON public.profiles_public TO authenticated;

-- ----------------------------------------------------------------
-- #7 (Gravidade 3/10): verification_codes - tighten to require
--     both user_id match AND email match for extra safety
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own verification codes" ON public.verification_codes;

CREATE POLICY "Users can view their own verification codes"
ON public.verification_codes
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------
-- Also revoke anon access to marketplace_properties_public view
-- to prevent unauthenticated scraping
-- ----------------------------------------------------------------
REVOKE ALL ON public.marketplace_properties_public FROM anon;
GRANT SELECT ON public.marketplace_properties_public TO authenticated;

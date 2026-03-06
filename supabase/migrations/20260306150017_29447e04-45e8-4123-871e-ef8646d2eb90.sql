-- Fix 1: Restrict profiles_public view permissions - revoke from anon, grant only to authenticated
REVOKE ALL ON public.profiles_public FROM anon;
REVOKE ALL ON public.profiles_public FROM public;
GRANT SELECT ON public.profiles_public TO authenticated;

-- Fix 2: Create a security definer function to check if user has manager+ role for ad_leads PII
CREATE OR REPLACE FUNCTION public.is_org_manager_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin', 'sub_admin', 'leader', 'developer')
  )
$$;

-- Fix 3: Replace profiles_public view with one that requires auth
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public WITH (security_invoker = true) AS
SELECT id, user_id, full_name, avatar_url, organization_id, onboarding_completed, created_at, updated_at
FROM profiles;

REVOKE ALL ON public.profiles_public FROM anon;
REVOKE ALL ON public.profiles_public FROM public;
GRANT SELECT ON public.profiles_public TO authenticated;

-- Fix 4: Replace ad_leads RLS - restrict PII fields via a secure view
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own org ad_leads" ON ad_leads;

-- Create policy that only allows managers+ to see ad_leads
CREATE POLICY "Managers can view own org ad_leads"
ON ad_leads FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND get_user_organization_id() IS NOT NULL
  AND is_org_manager_or_above(auth.uid())
);

-- Keep insert/update policies unchanged but add NULL checks
DROP POLICY IF EXISTS "System can insert ad_leads" ON ad_leads;
CREATE POLICY "System can insert ad_leads"
ON ad_leads FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id()
  AND get_user_organization_id() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can update own org ad_leads" ON ad_leads;
CREATE POLICY "Managers can update own org ad_leads"
ON ad_leads FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND get_user_organization_id() IS NOT NULL
  AND is_org_manager_or_above(auth.uid())
);
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Only admins can view API keys" ON public.imobzi_api_keys;
DROP POLICY IF EXISTS "Only admins can insert API keys" ON public.imobzi_api_keys;
DROP POLICY IF EXISTS "Only admins can delete API keys" ON public.imobzi_api_keys;

-- Create helper function for admin or leader check
CREATE OR REPLACE FUNCTION public.is_org_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = _user_id
          AND ur.role IN ('admin', 'leader')
    )
$$;

-- Recreate policies allowing admin AND leader roles
CREATE POLICY "Managers can view API keys"
  ON public.imobzi_api_keys FOR SELECT
  USING (organization_id = get_user_organization_id() AND is_org_manager(auth.uid()));

CREATE POLICY "Managers can insert API keys"
  ON public.imobzi_api_keys FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_manager(auth.uid()));

CREATE POLICY "Managers can delete API keys"
  ON public.imobzi_api_keys FOR DELETE
  USING (organization_id = get_user_organization_id() AND is_org_manager(auth.uid()));

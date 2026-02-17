
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Managers can view API keys" ON public.imobzi_api_keys;
DROP POLICY IF EXISTS "Managers can insert API keys" ON public.imobzi_api_keys;
DROP POLICY IF EXISTS "Managers can delete API keys" ON public.imobzi_api_keys;
DROP POLICY IF EXISTS "Admins can view API keys" ON public.imobzi_api_keys;
DROP POLICY IF EXISTS "Admins can insert API keys" ON public.imobzi_api_keys;
DROP POLICY IF EXISTS "Admins can delete API keys" ON public.imobzi_api_keys;

-- Create open policies for all org members
CREATE POLICY "Org members can view API keys"
  ON public.imobzi_api_keys FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Org members can insert API keys"
  ON public.imobzi_api_keys FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Org members can delete API keys"
  ON public.imobzi_api_keys FOR DELETE
  USING (organization_id = public.get_user_organization_id());

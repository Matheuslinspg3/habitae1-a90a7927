
-- Drop restrictive admin-only delete policy
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;

-- Allow all org members to delete leads
CREATE POLICY "Org members can delete leads"
  ON public.leads FOR DELETE
  USING (organization_id = public.get_user_organization_id());

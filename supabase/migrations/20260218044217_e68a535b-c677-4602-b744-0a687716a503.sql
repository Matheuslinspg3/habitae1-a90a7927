-- Fix leads SELECT policy to include sub_admin
DROP POLICY IF EXISTS "Users can view leads based on role" ON public.leads;
CREATE POLICY "Users can view leads based on role"
ON public.leads
FOR SELECT
USING (
  is_member_of_org(organization_id) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'sub_admin'::app_role) OR
    has_role(auth.uid(), 'leader'::app_role) OR
    has_role(auth.uid(), 'developer'::app_role) OR
    (broker_id = auth.uid())
  )
);

-- Fix leads UPDATE policy to include sub_admin
DROP POLICY IF EXISTS "Users can update leads based on role" ON public.leads;
CREATE POLICY "Users can update leads based on role"
ON public.leads
FOR UPDATE
USING (
  is_member_of_org(organization_id) AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'sub_admin'::app_role) OR
    has_role(auth.uid(), 'leader'::app_role) OR
    has_role(auth.uid(), 'developer'::app_role) OR
    (broker_id = auth.uid())
  )
);
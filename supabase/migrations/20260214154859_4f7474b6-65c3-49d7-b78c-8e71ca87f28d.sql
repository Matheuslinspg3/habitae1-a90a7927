
-- Drop the old permissive SELECT policy
DROP POLICY "Users can view leads in their organization" ON public.leads;

-- Create new SELECT policy: admins/leaders/developers see all org leads,
-- corretores only see leads assigned to them (broker_id = auth.uid())
CREATE POLICY "Users can view leads based on role"
ON public.leads
FOR SELECT
TO authenticated
USING (
  is_member_of_org(organization_id)
  AND (
    -- Admins, leaders, developers see everything in their org
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'leader')
    OR public.has_role(auth.uid(), 'developer')
    -- Corretores only see their assigned leads
    OR broker_id = auth.uid()
  )
);

-- Also restrict UPDATE: corretores can only update their own leads
DROP POLICY "Users can update leads in their organization" ON public.leads;

CREATE POLICY "Users can update leads based on role"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  is_member_of_org(organization_id)
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'leader')
    OR public.has_role(auth.uid(), 'developer')
    OR broker_id = auth.uid()
  )
);

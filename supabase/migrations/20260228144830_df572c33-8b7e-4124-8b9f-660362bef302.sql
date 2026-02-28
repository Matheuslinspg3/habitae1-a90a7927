
-- Drop existing SELECT and UPDATE policies
DROP POLICY "Users can view their own tickets" ON public.support_tickets;
DROP POLICY "Admins can update tickets" ON public.support_tickets;

-- Recreate SELECT: users see own tickets, developers see ALL tickets globally
CREATE POLICY "Users can view their own tickets"
ON public.support_tickets FOR SELECT
USING (
  (auth.uid() = user_id)
  OR has_role(auth.uid(), 'developer'::app_role)
  OR (is_member_of_org(organization_id) AND has_role(auth.uid(), 'admin'::app_role))
);

-- Recreate UPDATE: developers can update ANY ticket, admins only their org
CREATE POLICY "Admins can update tickets"
ON public.support_tickets FOR UPDATE
USING (
  has_role(auth.uid(), 'developer'::app_role)
  OR (is_member_of_org(organization_id) AND has_role(auth.uid(), 'admin'::app_role))
);

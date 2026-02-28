-- RLS policies for support_tickets
CREATE POLICY "Users can insert their own tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (auth.uid() = user_id AND organization_id = get_user_organization_id());

CREATE POLICY "Users can view their own tickets"
ON public.support_tickets
FOR SELECT
USING (auth.uid() = user_id OR (is_member_of_org(organization_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'developer'::app_role))));

CREATE POLICY "Admins can update tickets"
ON public.support_tickets
FOR UPDATE
USING (is_member_of_org(organization_id) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'developer'::app_role)));
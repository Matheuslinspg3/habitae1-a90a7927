-- Allow developers to delete tickets
CREATE POLICY "Developers can delete tickets"
ON public.support_tickets
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'developer'::app_role));

-- Allow developers to delete ticket messages (already have full access policy, but explicit delete)
-- The existing "Developers full access to ticket_messages" policy with polcmd='*' should cover delete already

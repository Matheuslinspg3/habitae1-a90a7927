
-- Table for ticket chat messages
CREATE TABLE public.ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'ai', 'support')),
  sender_id UUID,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);

-- Enable RLS
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Developers can read/write all messages
CREATE POLICY "Developers full access to ticket_messages"
ON public.ticket_messages
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'developer')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'developer')
);

-- Users can read messages from their own org's tickets
CREATE POLICY "Users can read own org ticket messages"
ON public.ticket_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM support_tickets st
    JOIN profiles p ON p.organization_id = st.organization_id
    WHERE st.id = ticket_messages.ticket_id
      AND p.user_id = auth.uid()
  )
);

-- Users can insert messages on their own org's tickets
CREATE POLICY "Users can insert own org ticket messages"
ON public.ticket_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM support_tickets st
    JOIN profiles p ON p.organization_id = st.organization_id
    WHERE st.id = ticket_messages.ticket_id
      AND p.user_id = auth.uid()
  )
);

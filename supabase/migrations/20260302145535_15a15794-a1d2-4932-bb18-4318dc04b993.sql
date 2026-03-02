
-- Notify ticket owner when AI or support replies
CREATE OR REPLACE FUNCTION public.notify_ticket_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
BEGIN
  -- Only notify for AI or support messages (not user's own messages)
  IF NEW.sender_role = 'user' THEN
    RETURN NEW;
  END IF;

  -- Get ticket info
  SELECT * INTO v_ticket
  FROM support_tickets
  WHERE id = NEW.ticket_id;

  IF v_ticket IS NULL THEN
    RETURN NEW;
  END IF;

  -- Notify the ticket owner
  PERFORM insert_notification(
    v_ticket.user_id,
    v_ticket.organization_id,
    'ticket_reply',
    'Resposta no seu ticket',
    'Há uma nova resposta no ticket "' || v_ticket.subject || '".',
    v_ticket.id,
    'ticket'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_ticket_reply
AFTER INSERT ON public.ticket_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_ticket_reply();

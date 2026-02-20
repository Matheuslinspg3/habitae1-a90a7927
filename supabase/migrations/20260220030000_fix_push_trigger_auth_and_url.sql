-- Fix push trigger delivery path:
-- 1) Stop depending on app.settings.* (often unset in DB, causing silent failures)
-- 2) Call send-push through stable project URL
-- 3) Remove mandatory JWT verification for send-push edge function (server-triggered call has no user JWT)

CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', COALESCE(NEW.message, ''),
      'entity_id', NEW.entity_id,
      'entity_type', NEW.entity_type,
      'notification_type', NEW.type
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trigger_push_on_notification failed for notification %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Use hardcoded URL and anon key (public, safe to embed)
  -- send-push has verify_jwt = false, so anon key is sufficient
  PERFORM net.http_post(
    url := 'https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZmxma2tqaXR2c3lzendkZmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDEzNzksImV4cCI6MjA4NjkxNzM3OX0._GxDwg_psa_ReqNFPFT7S5mKbTz1ZKWS6xEIsbuP6LA'
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
$function$;

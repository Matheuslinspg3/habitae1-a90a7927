
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  -- Use hardcoded Supabase URL (current_setting returns NULL if not configured)
  v_url := 'https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/send-push';
  
  -- Try to get service_role_key from vault, fallback to app.settings
  BEGIN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_key := NULL;
  END;
  
  IF v_key IS NULL THEN
    v_key := current_setting('app.settings.service_role_key', true);
  END IF;
  
  -- If we still don't have a key, skip push but log it
  IF v_key IS NULL OR v_key = '' THEN
    RAISE WARNING 'trigger_push_on_notification: service_role_key not found, skipping push for notification %', NEW.id;
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
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
  -- Log the error instead of silently swallowing
  RAISE WARNING 'trigger_push_on_notification failed for notification %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

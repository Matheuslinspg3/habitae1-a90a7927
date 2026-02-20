-- Fix push notification trigger
-- Bug: current_setting('app.settings.supabase_url', true) returned NULL because
-- this database setting was never configured, causing net.http_post to silently
-- fail on every notification insert (NULL URL = no-op, swallowed by EXCEPTION).
--
-- Fix: hardcode the Supabase project URL (public value, not a secret).
-- The service_role_key must be stored in Supabase Vault under the name
-- 'service_role_key' and referenced via vault.decrypted_secrets.
-- If vault is unavailable, fall back to app.settings.service_role_key
-- (set via: ALTER DATABASE postgres SET app.settings.service_role_key = '...').

CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  -- Hardcoded Supabase project URL (public, not a secret)
  v_url TEXT := 'https://aiflfkkjitvsyszwdfga.supabase.co/functions/v1/send-push';
  v_service_key TEXT;
BEGIN
  -- Try vault first, then fall back to database setting
  BEGIN
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  IF v_service_key IS NULL OR v_service_key = '' THEN
    v_service_key := current_setting('app.settings.service_role_key', true);
  END IF;

  -- Skip silently if service key is still not configured
  IF v_service_key IS NULL OR v_service_key = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
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
  -- Don't fail the notification insert if push fails
  RETURN NEW;
END;
$$;

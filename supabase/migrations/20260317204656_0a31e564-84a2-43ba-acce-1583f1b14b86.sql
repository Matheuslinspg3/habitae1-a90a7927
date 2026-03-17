-- Fix trigger_push_on_notification: use GUC settings instead of hardcoded URL/key
-- The app.settings.* values are set automatically by Supabase in newer versions,
-- or can be set manually via ALTER DATABASE SET app.settings.supabase_url = '...';

CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_anon_key text;
BEGIN
  -- Try to get URL from GUC settings (set via ALTER DATABASE or supabase config)
  v_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.supabase_anon_key', true);

  -- Skip if not configured
  IF v_url IS NULL OR v_url = '' OR v_anon_key IS NULL OR v_anon_key = '' THEN
    RAISE WARNING 'trigger_push_on_notification: app.settings.supabase_url or app.settings.supabase_anon_key not configured. Skipping push for notification %', NEW.id;
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_anon_key
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

-- Set the GUC variables for this project (current Lovable Cloud values)
-- After migration, run these two commands with your NEW Supabase URL and anon key:
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR-NEW-PROJECT.supabase.co';
-- ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'YOUR-NEW-ANON-KEY';

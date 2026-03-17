-- Update trigger to use hardcoded fallback for current project while supporting env vars for migration
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
  -- Try GUC settings first (for migrated projects)
  v_url := current_setting('app.settings.supabase_url', true);
  v_anon_key := current_setting('app.settings.supabase_anon_key', true);

  -- Fallback: read from app_runtime_config or use env-injected values
  IF v_url IS NULL OR v_url = '' THEN
    -- In Supabase, these are automatically available as request.header settings
    -- For self-hosted, set via: ALTER DATABASE postgres SET app.settings.supabase_url = '...';
    v_url := coalesce(
      current_setting('request.headers', true)::jsonb->>'x-supabase-url',
      (SELECT current_setting('pgsodium.supabase_url', true)),
      'https://aiflfkkjitvsyszwdfga.supabase.co'
    );
  END IF;

  IF v_anon_key IS NULL OR v_anon_key = '' THEN
    v_anon_key := coalesce(
      current_setting('request.headers', true)::jsonb->>'x-supabase-anon-key',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZmxma2tqaXR2c3lzendkZmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDEzNzksImV4cCI6MjA4NjkxNzM3OX0._GxDwg_psa_ReqNFPFT7S5mKbTz1ZKWS6xEIsbuP6LA'
    );
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
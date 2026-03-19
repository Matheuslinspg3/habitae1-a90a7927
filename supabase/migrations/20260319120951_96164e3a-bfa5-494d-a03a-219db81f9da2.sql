
-- Add new enum values if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'atendente' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE public.app_role ADD VALUE 'atendente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'desenvolvedor' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
    ALTER TYPE public.app_role ADD VALUE 'desenvolvedor';
  END IF;
END$$;

-- Create exec_sql function (bridge for migrations)
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'information_schema', 'auth', 'storage'
AS $$
DECLARE
  result json;
  caller_role text;
  clean_query text;
BEGIN
  caller_role := current_setting('request.jwt.claims', true)::json->>'role';
  IF caller_role IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: apenas service_role pode executar esta função.';
  END IF;
  clean_query := rtrim(sql_query, '; ');
  EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || clean_query || ') t' INTO result;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Auto-assign 'atendente' role to new users (if no trigger exists)
CREATE OR REPLACE FUNCTION public.auto_assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'atendente');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_default_role ON auth.users;

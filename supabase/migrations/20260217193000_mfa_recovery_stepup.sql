CREATE TABLE IF NOT EXISTS public.user_mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, code_hash)
);

ALTER TABLE public.user_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own recovery codes" ON public.user_mfa_recovery_codes;
CREATE POLICY "Users can manage own recovery codes"
ON public.user_mfa_recovery_codes
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.mfa_replace_recovery_codes(p_codes text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  normalized_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.user_mfa_recovery_codes
  WHERE user_id = auth.uid();

  FOREACH normalized_code IN ARRAY p_codes
  LOOP
    INSERT INTO public.user_mfa_recovery_codes (user_id, code_hash)
    VALUES (auth.uid(), crypt(upper(trim(normalized_code)), gen_salt('bf')));
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.mfa_consume_recovery_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  matched_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id
    INTO matched_id
  FROM public.user_mfa_recovery_codes
  WHERE user_id = auth.uid()
    AND used_at IS NULL
    AND code_hash = crypt(upper(trim(p_code)), code_hash)
  LIMIT 1;

  IF matched_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.user_mfa_recovery_codes
  SET used_at = now()
  WHERE id = matched_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.mfa_replace_recovery_codes(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mfa_consume_recovery_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mfa_replace_recovery_codes(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_consume_recovery_code(text) TO authenticated;

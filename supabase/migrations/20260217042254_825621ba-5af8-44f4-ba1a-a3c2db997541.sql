
-- AH-01: RPC to validate import run access by caller
CREATE OR REPLACE FUNCTION public.assert_import_run_access(p_run_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.import_runs ir
    JOIN public.profiles p ON p.organization_id = ir.organization_id
    WHERE ir.id = p_run_id AND p.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.assert_import_run_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_import_run_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_import_run_access(uuid, uuid) TO service_role;

-- AH-06: Restrict billing_webhook_logs insert to service_role only
DROP POLICY IF EXISTS "Webhook logs insert for authenticated users" ON public.billing_webhook_logs;
DROP POLICY IF EXISTS "webhook_logs_insert" ON public.billing_webhook_logs;
DROP POLICY IF EXISTS "Allow webhook log inserts" ON public.billing_webhook_logs;

-- Find and drop any INSERT policy with WITH CHECK (true)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'billing_webhook_logs' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.billing_webhook_logs', pol.policyname);
  END LOOP;
END $$;

-- Create restrictive insert policy (service_role bypasses RLS anyway, so this blocks authenticated/anon)
CREATE POLICY "billing_webhook_logs_insert_service_only"
ON public.billing_webhook_logs
FOR INSERT
WITH CHECK (false);

-- AH-05: Ensure CORS env var exists in concept (no SQL needed, just documenting)
-- CORS allowlist is handled in Edge Function code via APP_ALLOWED_ORIGINS env var

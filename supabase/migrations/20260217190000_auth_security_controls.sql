-- Auth security controls: failed-attempt logging, anomaly alerts, and temporary lockout policy.

CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email TEXT,
  session_id TEXT,
  ip_address INET,
  success BOOLEAN NOT NULL DEFAULT false,
  reason TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_created_at
  ON public.auth_login_attempts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_session_created
  ON public.auth_login_attempts (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_ip_created
  ON public.auth_login_attempts (ip_address, created_at DESC)
  WHERE ip_address IS NOT NULL;

ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'auth_login_attempts'
      AND policyname = 'auth_login_attempts_no_direct_access'
  ) THEN
    CREATE POLICY auth_login_attempts_no_direct_access
      ON public.auth_login_attempts
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END
$$;

CREATE OR REPLACE VIEW public.auth_login_anomalies AS
SELECT
  date_trunc('minute', created_at) AS minute_bucket,
  COUNT(*) FILTER (WHERE success = false) AS failed_attempts,
  COUNT(*) FILTER (WHERE success = true) AS successful_attempts,
  COUNT(DISTINCT ip_address) FILTER (WHERE success = false) AS distinct_failed_ips,
  COUNT(DISTINCT COALESCE(email, '<empty>')) FILTER (WHERE success = false) AS distinct_failed_accounts
FROM public.auth_login_attempts
WHERE created_at >= now() - interval '24 hours'
GROUP BY 1;

COMMENT ON VIEW public.auth_login_anomalies IS
'Use this view to trigger alerts when auth failure rate spikes.';

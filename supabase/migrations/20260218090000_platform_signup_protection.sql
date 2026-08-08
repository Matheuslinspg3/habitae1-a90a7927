-- Security telemetry and protection state for platform-signup abuse prevention
CREATE TABLE IF NOT EXISTS public.platform_signup_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  invite_id UUID,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'blocked', 'challenge_required')),
  user_agent TEXT,
  request_origin TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_platform_signup_attempts_created_at
  ON public.platform_signup_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_signup_attempts_ip_created_at
  ON public.platform_signup_attempts (ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_signup_attempts_invite_created_at
  ON public.platform_signup_attempts (invite_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_signup_security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('rate_limit', 'suspicious_pattern')),
  severity TEXT NOT NULL CHECK (severity IN ('medium', 'high', 'critical')),
  ip_address INET,
  invite_id UUID,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  handled BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_platform_signup_security_alerts_created_at
  ON public.platform_signup_security_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_signup_security_alerts_handled
  ON public.platform_signup_security_alerts (handled, created_at DESC);

ALTER TABLE public.platform_signup_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_signup_security_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to platform signup attempts" ON public.platform_signup_attempts;
CREATE POLICY "No direct access to platform signup attempts"
ON public.platform_signup_attempts
FOR ALL
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct access to platform signup alerts" ON public.platform_signup_security_alerts;
CREATE POLICY "No direct access to platform signup alerts"
ON public.platform_signup_security_alerts
FOR ALL
USING (false)
WITH CHECK (false);

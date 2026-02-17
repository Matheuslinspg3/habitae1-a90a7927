-- Remove anon direct-read access to platform invites.
DROP POLICY IF EXISTS "Public can read active platform invites" ON public.platform_invites;

-- Audit table for invite validation attempts (used by edge function).
CREATE TABLE IF NOT EXISTS public.platform_invite_validation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id_text TEXT NOT NULL,
  invite_id UUID,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_invite_validation_attempts_ip_created_at
  ON public.platform_invite_validation_attempts (ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_invite_validation_attempts_invite_created_at
  ON public.platform_invite_validation_attempts (invite_id_text, created_at DESC);

ALTER TABLE public.platform_invite_validation_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_invite_validation_attempts FROM anon, authenticated;


-- A02/A04: Add provider_event_id for idempotency
ALTER TABLE public.billing_webhook_logs
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT,
  ADD COLUMN IF NOT EXISTS event_status TEXT,
  ADD COLUMN IF NOT EXISTS payload_hash TEXT;

-- Unique index for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_webhook_logs_provider_event_id
  ON public.billing_webhook_logs (provider_event_id)
  WHERE provider_event_id IS NOT NULL;

-- Operational index
CREATE INDEX IF NOT EXISTS idx_billing_webhook_logs_created_at
  ON public.billing_webhook_logs (created_at DESC);

-- A03: Drop payload column (contains PII) and replace with sanitized version
-- We keep payload for now but add a cleanup function
-- Instead, we'll sanitize on insert in the edge function

-- A06: Harden accept_organization_invite privileges
REVOKE ALL ON FUNCTION public.accept_organization_invite(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_organization_invite(uuid, uuid, text) TO authenticated;

-- A08: Add invite_email to platform_invites for email binding
ALTER TABLE public.platform_invites
  ADD COLUMN IF NOT EXISTS invite_email TEXT;

-- A10: Add feed_token to portal_feeds for signed access
ALTER TABLE public.portal_feeds
  ADD COLUMN IF NOT EXISTS feed_token TEXT DEFAULT encode(gen_random_bytes(32), 'hex');

-- Set tokens for existing feeds
UPDATE public.portal_feeds SET feed_token = encode(gen_random_bytes(32), 'hex') WHERE feed_token IS NULL;

-- Make feed_token not null after populating
ALTER TABLE public.portal_feeds ALTER COLUMN feed_token SET NOT NULL;

-- Unique index on feed_token
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_feeds_feed_token ON public.portal_feeds (feed_token);

-- Harden webhook authenticity and idempotency keys
ALTER TABLE public.billing_webhook_logs
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.billing_webhook_logs
SET provider_payment_id = ''
WHERE provider_payment_id IS NULL;

ALTER TABLE public.billing_webhook_logs
  ALTER COLUMN provider_payment_id SET NOT NULL,
  ALTER COLUMN provider_payment_id SET DEFAULT '';

DROP INDEX IF EXISTS idx_billing_webhook_logs_provider_event_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_webhook_logs_provider_event_payment
  ON public.billing_webhook_logs (provider, provider_event_id, provider_payment_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_webhook_logs_received_at
  ON public.billing_webhook_logs (received_at DESC);

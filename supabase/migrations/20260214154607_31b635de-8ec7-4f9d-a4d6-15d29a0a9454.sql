
-- Add unique constraint for provider_payment_id used in webhook upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_payments_provider_payment_id 
  ON public.billing_payments(provider_payment_id) 
  WHERE provider_payment_id IS NOT NULL;

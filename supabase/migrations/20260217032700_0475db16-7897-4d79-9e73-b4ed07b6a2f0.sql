
-- Remove the old permissive INSERT policy on billing_webhook_logs
DROP POLICY IF EXISTS "Anyone can insert webhook logs" ON public.billing_webhook_logs;

-- Create restricted INSERT policy for service_role only
CREATE POLICY "Service role can insert webhook logs"
  ON public.billing_webhook_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

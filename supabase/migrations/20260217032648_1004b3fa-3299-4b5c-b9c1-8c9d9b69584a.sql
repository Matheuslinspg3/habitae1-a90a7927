
-- Fix: billing_webhook_logs SELECT - use has_role() for admin access
DROP POLICY IF EXISTS "Admins can view webhook logs" ON public.billing_webhook_logs;
CREATE POLICY "Admins can view webhook logs"
  ON public.billing_webhook_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')
  );

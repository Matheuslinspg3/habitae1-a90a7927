
-- Fix overly permissive INSERT policy on notifications
DROP POLICY "System can insert notifications" ON public.notifications;

-- Only allow inserts from authenticated users or service role (trigger runs as SECURITY DEFINER)
CREATE POLICY "Authenticated users can receive notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

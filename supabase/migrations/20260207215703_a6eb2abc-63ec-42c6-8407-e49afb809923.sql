
-- Fix: admin_allowlist has RLS enabled but no policies
-- Only system admins should read/manage this table
CREATE POLICY "System admins can view allowlist"
  ON public.admin_allowlist FOR SELECT
  USING (public.is_system_admin());

CREATE POLICY "System admins can insert into allowlist"
  ON public.admin_allowlist FOR INSERT
  WITH CHECK (public.is_system_admin());

CREATE POLICY "System admins can delete from allowlist"
  ON public.admin_allowlist FOR DELETE
  USING (public.is_system_admin());

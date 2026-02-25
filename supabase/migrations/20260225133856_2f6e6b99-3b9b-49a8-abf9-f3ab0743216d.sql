
-- Drop the restrictive insert policy and replace with one that allows admin or sub_admin
DROP POLICY "Admins can insert rd_station_settings" ON public.rd_station_settings;
DROP POLICY "Admins can update rd_station_settings" ON public.rd_station_settings;

CREATE POLICY "Managers can insert rd_station_settings"
  ON public.rd_station_settings FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_manager(auth.uid()));

CREATE POLICY "Managers can update rd_station_settings"
  ON public.rd_station_settings FOR UPDATE
  USING (organization_id = get_user_organization_id() AND is_org_manager(auth.uid()));

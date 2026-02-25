
-- RD Station integration settings per organization
CREATE TABLE public.rd_station_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  default_stage_id UUID REFERENCES public.lead_stages(id) ON DELETE SET NULL,
  default_source TEXT NOT NULL DEFAULT 'RD Station',
  auto_send_to_crm BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.rd_station_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org rd_station_settings"
  ON public.rd_station_settings FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can insert rd_station_settings"
  ON public.rd_station_settings FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id() AND is_org_admin(auth.uid()));

CREATE POLICY "Admins can update rd_station_settings"
  ON public.rd_station_settings FOR UPDATE
  USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid()));

-- Webhook log for debugging
CREATE TABLE public.rd_station_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT,
  payload JSONB NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rd_station_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org webhook logs"
  ON public.rd_station_webhook_logs FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_rd_station_settings
  BEFORE UPDATE ON public.rd_station_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_support();

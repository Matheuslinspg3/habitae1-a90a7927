
-- Table for WhatsApp instances (1 per organization)
CREATE TABLE public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  instance_name text NOT NULL,
  instance_token text,
  phone_number text,
  status text NOT NULL DEFAULT 'disconnected',
  qr_code text,
  webhook_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Managers can view their org's instance
CREATE POLICY "Managers can view own org instance"
  ON public.whatsapp_instances FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
    AND public.is_org_manager_or_above(auth.uid())
  );

-- Managers can insert for their org
CREATE POLICY "Managers can insert own org instance"
  ON public.whatsapp_instances FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
    AND public.is_org_manager_or_above(auth.uid())
  );

-- Managers can update their org's instance
CREATE POLICY "Managers can update own org instance"
  ON public.whatsapp_instances FOR UPDATE TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
    AND public.is_org_manager_or_above(auth.uid())
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
    AND public.is_org_manager_or_above(auth.uid())
  );

-- Managers can delete their org's instance
CREATE POLICY "Managers can delete own org instance"
  ON public.whatsapp_instances FOR DELETE TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
    AND public.is_org_manager_or_above(auth.uid())
  );

-- Updated_at trigger
CREATE TRIGGER set_whatsapp_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_support();

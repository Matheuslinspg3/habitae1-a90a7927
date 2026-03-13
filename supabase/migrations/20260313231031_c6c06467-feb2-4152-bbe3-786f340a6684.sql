
-- 1. Track member join/leave events
CREATE TABLE public.organization_member_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('joined', 'removed', 'left')),
  performed_by uuid,
  reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_member_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view member events"
  ON public.organization_member_events FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
    AND public.is_org_manager_or_above(auth.uid())
  );

CREATE POLICY "System can insert member events"
  ON public.organization_member_events FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
    AND public.is_org_manager_or_above(auth.uid())
  );

CREATE INDEX idx_member_events_org ON public.organization_member_events(organization_id, created_at DESC);

-- 2. Custom roles per organization
CREATE TABLE public.organization_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#6b7280',
  base_role text NOT NULL DEFAULT 'corretor',
  module_permissions jsonb NOT NULL DEFAULT '{"crm": true, "properties": true, "contracts": false, "financial": false, "schedule": true, "marketplace": true, "integrations": false, "ads": false, "activities": false, "owners": false}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE public.organization_custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view custom roles"
  ON public.organization_custom_roles FOR SELECT TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Org admins can manage custom roles"
  ON public.organization_custom_roles FOR ALL TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
    AND public.is_org_admin(auth.uid())
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
    AND public.is_org_admin(auth.uid())
  );

-- 3. Assign custom role to a member (optional override)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES public.organization_custom_roles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS removed_at timestamptz;

-- Enable realtime for member events
ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_member_events;

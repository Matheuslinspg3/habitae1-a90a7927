
-- Table for platform invites (inviting new real estate agencies)
CREATE TABLE public.platform_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT, -- optional name/label for the invite
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
  used_by_organization_id UUID REFERENCES public.organizations(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

-- Enable RLS
ALTER TABLE public.platform_invites ENABLE ROW LEVEL SECURITY;

-- Policies: only developers and leaders can manage platform invites
CREATE POLICY "Developers and leaders can manage platform invites"
  ON public.platform_invites
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'developer') OR public.has_role(auth.uid(), 'leader')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'developer') OR public.has_role(auth.uid(), 'leader')
  );

-- Add trial columns to organizations
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

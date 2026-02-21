
-- Enum for ad lead status
CREATE TYPE public.ad_lead_status AS ENUM ('new', 'read', 'sent_to_crm', 'send_failed', 'archived');

-- Enum for ad provider
CREATE TYPE public.ad_provider AS ENUM ('meta', 'google');

-- Enum for ad entity type
CREATE TYPE public.ad_entity_type AS ENUM ('campaign', 'adset', 'ad');

-- 1) ad_accounts
CREATE TABLE public.ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider ad_provider NOT NULL DEFAULT 'meta',
  external_account_id TEXT,
  name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auth_payload JSONB,
  status TEXT NOT NULL DEFAULT 'disconnected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_ad_accounts_org_provider ON public.ad_accounts (organization_id, provider);
ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org ad_accounts" ON public.ad_accounts FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins can insert ad_accounts" ON public.ad_accounts FOR INSERT WITH CHECK (organization_id = get_user_organization_id() AND (is_org_admin(auth.uid()) OR is_org_manager(auth.uid())));
CREATE POLICY "Admins can update ad_accounts" ON public.ad_accounts FOR UPDATE USING (organization_id = get_user_organization_id() AND (is_org_admin(auth.uid()) OR is_org_manager(auth.uid())));
CREATE POLICY "Admins can delete ad_accounts" ON public.ad_accounts FOR DELETE USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid()));

-- 2) ad_entities
CREATE TABLE public.ad_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider ad_provider NOT NULL DEFAULT 'meta',
  entity_type ad_entity_type NOT NULL DEFAULT 'ad',
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT,
  thumbnail_url TEXT,
  parent_external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_ad_entities_unique ON public.ad_entities (organization_id, provider, entity_type, external_id);
ALTER TABLE public.ad_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org ad_entities" ON public.ad_entities FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "System can insert ad_entities" ON public.ad_entities FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "System can update ad_entities" ON public.ad_entities FOR UPDATE USING (organization_id = get_user_organization_id());
CREATE POLICY "System can delete ad_entities" ON public.ad_entities FOR DELETE USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid()));

-- 3) ad_insights_daily
CREATE TABLE public.ad_insights_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider ad_provider NOT NULL DEFAULT 'meta',
  entity_type ad_entity_type NOT NULL DEFAULT 'ad',
  external_id TEXT NOT NULL,
  date DATE NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  ctr NUMERIC(8,4),
  cpc NUMERIC(12,4),
  cpl NUMERIC(12,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_ad_insights_unique ON public.ad_insights_daily (organization_id, provider, entity_type, external_id, date);
ALTER TABLE public.ad_insights_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org insights" ON public.ad_insights_daily FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "System can insert insights" ON public.ad_insights_daily FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "System can update insights" ON public.ad_insights_daily FOR UPDATE USING (organization_id = get_user_organization_id());

-- 4) ad_leads
CREATE TABLE public.ad_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider ad_provider NOT NULL DEFAULT 'meta',
  external_lead_id TEXT NOT NULL,
  external_ad_id TEXT NOT NULL,
  external_form_id TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  created_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  status ad_lead_status NOT NULL DEFAULT 'new',
  status_reason TEXT,
  raw_payload JSONB,
  crm_record_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_ad_leads_dedupe ON public.ad_leads (organization_id, provider, external_lead_id);
CREATE INDEX idx_ad_leads_by_ad ON public.ad_leads (organization_id, provider, external_ad_id);
CREATE INDEX idx_ad_leads_by_status ON public.ad_leads (organization_id, status);
ALTER TABLE public.ad_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org ad_leads" ON public.ad_leads FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "System can insert ad_leads" ON public.ad_leads FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "Users can update own org ad_leads" ON public.ad_leads FOR UPDATE USING (organization_id = get_user_organization_id());

-- 5) ad_settings (automação CRM por tenant)
CREATE TABLE public.ad_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  auto_send_to_crm BOOLEAN NOT NULL DEFAULT false,
  crm_stage_id UUID REFERENCES public.lead_stages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_ad_settings_org ON public.ad_settings (organization_id);
ALTER TABLE public.ad_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org ad_settings" ON public.ad_settings FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins can insert ad_settings" ON public.ad_settings FOR INSERT WITH CHECK (organization_id = get_user_organization_id() AND (is_org_admin(auth.uid()) OR is_org_manager(auth.uid())));
CREATE POLICY "Admins can update ad_settings" ON public.ad_settings FOR UPDATE USING (organization_id = get_user_organization_id() AND (is_org_admin(auth.uid()) OR is_org_manager(auth.uid())));

-- Helper function: count new leads per ad
CREATE OR REPLACE FUNCTION public.count_new_ad_leads(p_organization_id UUID, p_external_ad_id TEXT DEFAULT NULL)
RETURNS BIGINT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM ad_leads
  WHERE organization_id = p_organization_id
    AND status = 'new'
    AND (p_external_ad_id IS NULL OR external_ad_id = p_external_ad_id);
$$;

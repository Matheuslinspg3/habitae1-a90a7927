
-- Table to manage portal feed configurations per organization
CREATE TABLE public.portal_feeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  portal_name TEXT NOT NULL, -- olx_zap, chavesnamao, imovelweb, casamineira, 123i
  portal_label TEXT NOT NULL, -- Display name
  is_active BOOLEAN NOT NULL DEFAULT false,
  feed_url TEXT, -- Auto-generated public feed URL
  property_filter JSONB DEFAULT '{}'::jsonb, -- Filters: status, transaction_type, neighborhoods, etc.
  last_generated_at TIMESTAMPTZ,
  total_properties_exported INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, portal_name)
);

-- Table for feed generation logs/audit
CREATE TABLE public.portal_feed_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_id UUID NOT NULL REFERENCES public.portal_feeds(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  properties_count INTEGER NOT NULL DEFAULT 0,
  errors_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error_details JSONB
);

-- Enable RLS
ALTER TABLE public.portal_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_feed_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for portal_feeds
CREATE POLICY "Users can view their org portal feeds"
  ON public.portal_feeds FOR SELECT
  USING (is_member_of_org(organization_id));

CREATE POLICY "Users can create portal feeds for their org"
  ON public.portal_feeds FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update their org portal feeds"
  ON public.portal_feeds FOR UPDATE
  USING (is_member_of_org(organization_id));

CREATE POLICY "Users can delete their org portal feeds"
  ON public.portal_feeds FOR DELETE
  USING (is_member_of_org(organization_id));

-- RLS policies for portal_feed_logs
CREATE POLICY "Users can view their org feed logs"
  ON public.portal_feed_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.portal_feeds pf
    WHERE pf.id = portal_feed_logs.feed_id
    AND is_member_of_org(pf.organization_id)
  ));

CREATE POLICY "Users can insert feed logs for their org"
  ON public.portal_feed_logs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.portal_feeds pf
    WHERE pf.id = portal_feed_logs.feed_id
    AND is_member_of_org(pf.organization_id)
  ));

-- Indexes
CREATE INDEX idx_portal_feeds_org ON public.portal_feeds(organization_id);
CREATE INDEX idx_portal_feed_logs_feed ON public.portal_feed_logs(feed_id);

-- Trigger for updated_at
CREATE TRIGGER update_portal_feeds_updated_at
  BEFORE UPDATE ON public.portal_feeds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- Add unique constraints for upserts in sync functions
CREATE UNIQUE INDEX IF NOT EXISTS ad_leads_org_external_lead_idx ON public.ad_leads (organization_id, external_lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS ad_entities_org_provider_external_idx ON public.ad_entities (organization_id, provider, external_id);
CREATE UNIQUE INDEX IF NOT EXISTS ad_insights_daily_org_provider_ext_date_idx ON public.ad_insights_daily (organization_id, provider, external_id, date);

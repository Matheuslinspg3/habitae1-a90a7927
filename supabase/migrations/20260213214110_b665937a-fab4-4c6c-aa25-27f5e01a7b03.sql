
-- Phase 1: CRM Import - Database Schema

-- 1. Create crm_import_logs table
CREATE TABLE public.crm_import_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  import_type text NOT NULL CHECK (import_type IN ('csv', 'imobzi_api')),
  file_name text,
  total_processed int NOT NULL DEFAULT 0,
  total_imported int NOT NULL DEFAULT 0,
  total_duplicates int NOT NULL DEFAULT 0,
  total_updated int NOT NULL DEFAULT 0,
  total_errors int NOT NULL DEFAULT 0,
  settings jsonb DEFAULT '{}',
  report jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_import_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for crm_import_logs
CREATE POLICY "Users can view their org import logs"
  ON public.crm_import_logs FOR SELECT
  USING (is_member_of_org(organization_id));

CREATE POLICY "Users can create import logs for their org"
  ON public.crm_import_logs FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- 2. Add new columns to leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS temperature text CHECK (temperature IN ('frio', 'morno', 'quente')),
  ADD COLUMN IF NOT EXISTS imported_at timestamptz;

-- Index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_leads_email_org ON public.leads(email, organization_id) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_phone_org ON public.leads(phone, organization_id) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_external_id ON public.leads(external_id, external_source, organization_id) WHERE external_id IS NOT NULL;

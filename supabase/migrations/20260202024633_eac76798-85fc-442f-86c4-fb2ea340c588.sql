-- ============================================
-- MIGRATION: Import Runs Audit Tables + Property Import Status Fields
-- ============================================

-- 1. Create import_runs table for auditing each import execution
CREATE TABLE IF NOT EXISTS public.import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_provider TEXT NOT NULL DEFAULT 'imobzi',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  total_properties INT DEFAULT 0,
  imported INT DEFAULT 0,
  updated INT DEFAULT 0,
  errors INT DEFAULT 0,
  skipped INT DEFAULT 0,
  images_processed INT DEFAULT 0,
  images_failed INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create import_run_items table for tracking each property in an import run
CREATE TABLE IF NOT EXISTS public.import_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.import_runs(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  source_property_id TEXT NOT NULL,
  source_title TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'incomplete', 'error', 'skipped')),
  detail_fetched BOOLEAN DEFAULT false,
  photos_fetched BOOLEAN DEFAULT false,
  retry_count INT DEFAULT 0,
  error_message TEXT,
  warnings JSONB DEFAULT '[]'::jsonb,
  photos_expected INT DEFAULT 0,
  photos_imported INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Add new columns to properties table for import status tracking
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS import_status TEXT CHECK (import_status IS NULL OR import_status IN ('complete', 'incomplete', 'needs_retry')),
  ADD COLUMN IF NOT EXISTS import_warnings JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS description_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS imobzi_updated_at TIMESTAMPTZ;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_import_runs_org_id ON public.import_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_import_runs_status ON public.import_runs(status);
CREATE INDEX IF NOT EXISTS idx_import_run_items_run_id ON public.import_run_items(run_id);
CREATE INDEX IF NOT EXISTS idx_import_run_items_status ON public.import_run_items(status);
CREATE INDEX IF NOT EXISTS idx_properties_import_status ON public.properties(import_status) WHERE import_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_source_provider ON public.properties(source_provider, source_property_id) WHERE source_provider IS NOT NULL;

-- 5. Enable RLS on new tables
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_run_items ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for import_runs
CREATE POLICY "Users can view their organization's import runs"
  ON public.import_runs
  FOR SELECT
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert import runs for their organization"
  ON public.import_runs
  FOR INSERT
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their organization's import runs"
  ON public.import_runs
  FOR UPDATE
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- 7. Create RLS policies for import_run_items
CREATE POLICY "Users can view their organization's import run items"
  ON public.import_run_items
  FOR SELECT
  USING (run_id IN (
    SELECT id FROM public.import_runs 
    WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can insert import run items for their organization"
  ON public.import_run_items
  FOR INSERT
  WITH CHECK (run_id IN (
    SELECT id FROM public.import_runs 
    WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can update their organization's import run items"
  ON public.import_run_items
  FOR UPDATE
  USING (run_id IN (
    SELECT id FROM public.import_runs 
    WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  ));

-- 8. Trigger to update updated_at on import_run_items
CREATE OR REPLACE FUNCTION public.update_import_run_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_import_run_items_updated_at ON public.import_run_items;
CREATE TRIGGER update_import_run_items_updated_at
  BEFORE UPDATE ON public.import_run_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_import_run_items_updated_at();
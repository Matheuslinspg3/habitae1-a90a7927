
-- Add availability_status to properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS availability_status_updated_at timestamptz DEFAULT now();

-- Create property_status_history table
CREATE TABLE IF NOT EXISTS public.property_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  old_status text,
  new_status text NOT NULL,
  changed_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view status history" ON public.property_status_history
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Org members can insert status history" ON public.property_status_history
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_property_status_history_property ON public.property_status_history(property_id, created_at DESC);

-- Trigger to auto-record status changes
CREATE OR REPLACE FUNCTION public.log_property_availability_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.availability_status IS DISTINCT FROM NEW.availability_status THEN
    INSERT INTO property_status_history (property_id, organization_id, old_status, new_status, changed_by)
    VALUES (NEW.id, NEW.organization_id, OLD.availability_status, NEW.availability_status, COALESCE(auth.uid(), NEW.created_by));
    
    NEW.availability_status_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_property_availability_change
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.log_property_availability_change();

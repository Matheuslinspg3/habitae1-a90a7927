-- Create table for multiple Imobzi API keys per organization
CREATE TABLE public.imobzi_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for organization lookup
CREATE INDEX idx_imobzi_api_keys_org ON public.imobzi_api_keys(organization_id);

-- Enable RLS
ALTER TABLE public.imobzi_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization's API keys"
ON public.imobzi_api_keys
FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert API keys for their organization"
ON public.imobzi_api_keys
FOR INSERT
WITH CHECK (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete their organization's API keys"
ON public.imobzi_api_keys
FOR DELETE
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

-- Add updated_at trigger
CREATE TRIGGER update_imobzi_api_keys_updated_at
BEFORE UPDATE ON public.imobzi_api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
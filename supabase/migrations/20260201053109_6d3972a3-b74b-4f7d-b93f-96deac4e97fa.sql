-- Create audit_logs table for tracking bulk operations
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_ids UUID[] NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_audit_logs_org_id ON public.audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs(entity_type);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies: only org members can view their audit logs
CREATE POLICY "Users can view their organization audit logs"
ON public.audit_logs
FOR SELECT
USING (public.is_member_of_org(organization_id));

-- Only admins can insert audit logs (via security definer function)
CREATE POLICY "Admins can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (
    public.is_member_of_org(organization_id) 
    AND public.is_org_admin(auth.uid())
);

-- Create function to log bulk operations
CREATE OR REPLACE FUNCTION public.log_bulk_operation(
    p_org_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_ids UUID[],
    p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        organization_id,
        user_id,
        action,
        entity_type,
        entity_ids,
        details
    ) VALUES (
        p_org_id,
        auth.uid(),
        p_action,
        p_entity_type,
        p_entity_ids,
        p_details
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;
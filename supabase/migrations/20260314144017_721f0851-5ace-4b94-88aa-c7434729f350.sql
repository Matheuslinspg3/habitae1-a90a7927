-- ================================================================
-- FASE 1: Tabela audit_events + Função insert + RLS + Índices
-- ================================================================

CREATE TABLE public.audit_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  user_id         uuid,
  acting_role     text,
  target_user_id  uuid,
  entity_type     text NOT NULL,
  entity_id       text,
  entity_name     text,
  parent_entity_type text,
  parent_entity_id   text,
  action          text NOT NULL,
  action_category text NOT NULL,
  module          text,
  description     text,
  old_values      jsonb,
  new_values      jsonb,
  changed_fields  text[],
  metadata        jsonb DEFAULT '{}',
  source          text DEFAULT 'web',
  status          text DEFAULT 'success',
  risk_level      text DEFAULT 'low',
  ip_address      inet,
  user_agent      text,
  session_id      text,
  request_id      text,
  route           text
);

-- Índices para performance
CREATE INDEX idx_audit_org_created ON audit_events (organization_id, created_at DESC);
CREATE INDEX idx_audit_user_created ON audit_events (user_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_events (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_events (action, created_at DESC);
CREATE INDEX idx_audit_status_risk ON audit_events (status, risk_level, created_at DESC) WHERE status != 'success';
CREATE INDEX idx_audit_module ON audit_events (module, created_at DESC);

-- RLS
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Developer vê tudo
CREATE POLICY "developers_full_access" ON audit_events
FOR SELECT TO authenticated
USING (is_system_admin());

-- Admin/sub_admin vê apenas sua org
CREATE POLICY "org_managers_view_own" ON audit_events
FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND is_org_manager_or_above(auth.uid())
);

-- Apenas INSERT via service_role ou função SECURITY DEFINER
-- Nenhuma política INSERT = apenas service_role pode inserir diretamente

-- Função SECURITY DEFINER para inserção segura
CREATE OR REPLACE FUNCTION public.insert_audit_event(
  p_organization_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_acting_role text DEFAULT 'system',
  p_entity_type text DEFAULT 'system',
  p_entity_id text DEFAULT NULL,
  p_entity_name text DEFAULT NULL,
  p_action text DEFAULT 'unknown',
  p_action_category text DEFAULT 'admin',
  p_module text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_changed_fields text[] DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}',
  p_source text DEFAULT 'trigger',
  p_status text DEFAULT 'success',
  p_risk_level text DEFAULT 'low',
  p_target_user_id uuid DEFAULT NULL,
  p_parent_entity_type text DEFAULT NULL,
  p_parent_entity_id text DEFAULT NULL,
  p_route text DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_events (
    organization_id, user_id, acting_role, entity_type, entity_id,
    entity_name, action, action_category, module, description,
    old_values, new_values, changed_fields, metadata, source,
    status, risk_level, target_user_id, parent_entity_type,
    parent_entity_id, route, ip_address, user_agent, session_id, request_id
  ) VALUES (
    p_organization_id, p_user_id, p_acting_role, p_entity_type, p_entity_id,
    p_entity_name, p_action, p_action_category, p_module, p_description,
    p_old_values, p_new_values, p_changed_fields, p_metadata, p_source,
    p_status, p_risk_level, p_target_user_id, p_parent_entity_type,
    p_parent_entity_id, p_route, p_ip_address, p_user_agent, p_session_id, p_request_id
  );
END;
$$;
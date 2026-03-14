-- ================================================================
-- FASE 2: Triggers de auditoria para entidades de negócio
-- ================================================================

-- Helper: detectar role do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT ur.role::text FROM user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1),
    'system'
  );
$$;

-- ================================================================
-- TRIGGER: LEADS (create, update, delete)
-- ================================================================
CREATE OR REPLACE FUNCTION public.audit_lead_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_action text; v_desc text; v_changed text[]; v_old jsonb; v_new jsonb;
  v_risk text := 'low'; v_cat text;
BEGIN
  v_changed := ARRAY[]::text[]; v_old := '{}'::jsonb; v_new := '{}'::jsonb;

  IF TG_OP = 'INSERT' THEN
    v_action := 'lead.created'; v_cat := 'create';
    v_desc := 'Lead "' || NEW.name || '" criado';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'lead.deleted'; v_cat := 'delete'; v_risk := 'high';
    v_desc := 'Lead "' || OLD.name || '" removido';
  ELSIF TG_OP = 'UPDATE' THEN
    v_cat := 'update';
    IF OLD.lead_stage_id IS DISTINCT FROM NEW.lead_stage_id THEN
      v_action := 'lead.moved_stage';
      v_changed := array_append(v_changed, 'lead_stage_id');
      v_old := jsonb_build_object('lead_stage_id', OLD.lead_stage_id);
      v_new := jsonb_build_object('lead_stage_id', NEW.lead_stage_id);
      v_desc := 'Lead "' || NEW.name || '" movido de estágio';
    ELSIF OLD.broker_id IS DISTINCT FROM NEW.broker_id THEN
      v_action := 'lead.assigned'; v_cat := 'move';
      v_changed := array_append(v_changed, 'broker_id');
      v_old := jsonb_build_object('broker_id', OLD.broker_id);
      v_new := jsonb_build_object('broker_id', NEW.broker_id);
      v_desc := 'Lead "' || NEW.name || '" atribuído a novo corretor';
    ELSIF OLD.is_active = true AND NEW.is_active = false THEN
      v_action := 'lead.archived'; v_risk := 'medium';
      v_desc := 'Lead "' || NEW.name || '" arquivado';
    ELSIF OLD.is_active = false AND NEW.is_active = true THEN
      v_action := 'lead.reactivated';
      v_desc := 'Lead "' || NEW.name || '" reativado';
    ELSE
      v_action := 'lead.updated';
      IF OLD.name IS DISTINCT FROM NEW.name THEN v_changed := array_append(v_changed, 'name'); v_old := v_old || jsonb_build_object('name', OLD.name); v_new := v_new || jsonb_build_object('name', NEW.name); END IF;
      IF OLD.email IS DISTINCT FROM NEW.email THEN v_changed := array_append(v_changed, 'email'); END IF;
      IF OLD.phone IS DISTINCT FROM NEW.phone THEN v_changed := array_append(v_changed, 'phone'); END IF;
      IF OLD.estimated_value IS DISTINCT FROM NEW.estimated_value THEN v_changed := array_append(v_changed, 'estimated_value'); v_old := v_old || jsonb_build_object('estimated_value', OLD.estimated_value); v_new := v_new || jsonb_build_object('estimated_value', NEW.estimated_value); END IF;
      IF OLD.notes IS DISTINCT FROM NEW.notes THEN v_changed := array_append(v_changed, 'notes'); END IF;
      IF OLD.source IS DISTINCT FROM NEW.source THEN v_changed := array_append(v_changed, 'source'); END IF;
      IF OLD.temperature IS DISTINCT FROM NEW.temperature THEN v_changed := array_append(v_changed, 'temperature'); END IF;
      IF array_length(v_changed, 1) IS NULL THEN RETURN NEW; END IF;
      v_desc := 'Lead "' || NEW.name || '" atualizado (' || array_to_string(v_changed, ', ') || ')';
    END IF;
  END IF;

  PERFORM insert_audit_event(
    COALESCE(NEW.organization_id, OLD.organization_id),
    COALESCE(auth.uid(), NEW.created_by, OLD.created_by),
    get_current_user_role(), 'lead',
    COALESCE(NEW.id, OLD.id)::text, COALESCE(NEW.name, OLD.name),
    v_action, v_cat, 'crm', v_desc, v_old, v_new, v_changed,
    '{}', 'trigger', 'success', v_risk
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_leads
AFTER INSERT OR UPDATE OR DELETE ON leads
FOR EACH ROW EXECUTE FUNCTION audit_lead_changes();

-- ================================================================
-- TRIGGER: PROPERTIES
-- ================================================================
CREATE OR REPLACE FUNCTION public.audit_property_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_action text; v_desc text; v_changed text[]; v_old jsonb; v_new jsonb;
  v_risk text := 'low'; v_cat text;
BEGIN
  v_changed := ARRAY[]::text[]; v_old := '{}'::jsonb; v_new := '{}'::jsonb;

  IF TG_OP = 'INSERT' THEN
    v_action := 'property.created'; v_cat := 'create';
    v_desc := 'Imóvel "' || COALESCE(NEW.title, NEW.property_code, '') || '" cadastrado';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'property.deleted'; v_cat := 'delete'; v_risk := 'high';
    v_desc := 'Imóvel "' || COALESCE(OLD.title, OLD.property_code, '') || '" removido';
  ELSIF TG_OP = 'UPDATE' THEN
    v_cat := 'update';
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'property.status_changed'; v_risk := 'medium';
      v_changed := array_append(v_changed, 'status');
      v_old := jsonb_build_object('status', OLD.status); v_new := jsonb_build_object('status', NEW.status);
      v_desc := 'Imóvel "' || COALESCE(NEW.title,'') || '" status: ' || OLD.status || ' → ' || NEW.status;
    ELSIF OLD.availability_status IS DISTINCT FROM NEW.availability_status THEN
      v_action := 'property.availability_changed'; v_risk := 'medium';
      v_changed := array_append(v_changed, 'availability_status');
      v_old := jsonb_build_object('availability_status', OLD.availability_status);
      v_new := jsonb_build_object('availability_status', NEW.availability_status);
      v_desc := 'Imóvel "' || COALESCE(NEW.title,'') || '" disponibilidade: ' || COALESCE(OLD.availability_status,'') || ' → ' || COALESCE(NEW.availability_status,'');
    ELSE
      v_action := 'property.updated';
      IF OLD.title IS DISTINCT FROM NEW.title THEN v_changed := array_append(v_changed, 'title'); END IF;
      IF OLD.sale_price IS DISTINCT FROM NEW.sale_price THEN v_changed := array_append(v_changed, 'sale_price'); v_risk := 'medium'; v_old := v_old || jsonb_build_object('sale_price', OLD.sale_price); v_new := v_new || jsonb_build_object('sale_price', NEW.sale_price); END IF;
      IF OLD.rent_price IS DISTINCT FROM NEW.rent_price THEN v_changed := array_append(v_changed, 'rent_price'); v_risk := 'medium'; v_old := v_old || jsonb_build_object('rent_price', OLD.rent_price); v_new := v_new || jsonb_build_object('rent_price', NEW.rent_price); END IF;
      IF OLD.description IS DISTINCT FROM NEW.description THEN v_changed := array_append(v_changed, 'description'); END IF;
      IF OLD.bedrooms IS DISTINCT FROM NEW.bedrooms THEN v_changed := array_append(v_changed, 'bedrooms'); END IF;
      IF OLD.address_city IS DISTINCT FROM NEW.address_city THEN v_changed := array_append(v_changed, 'address_city'); END IF;
      IF OLD.address_neighborhood IS DISTINCT FROM NEW.address_neighborhood THEN v_changed := array_append(v_changed, 'address_neighborhood'); END IF;
      IF OLD.transaction_type IS DISTINCT FROM NEW.transaction_type THEN v_changed := array_append(v_changed, 'transaction_type'); END IF;
      IF array_length(v_changed, 1) IS NULL THEN RETURN NEW; END IF;
      v_desc := 'Imóvel "' || COALESCE(NEW.title,'') || '" atualizado (' || array_to_string(v_changed, ', ') || ')';
    END IF;
  END IF;

  PERFORM insert_audit_event(
    COALESCE(NEW.organization_id, OLD.organization_id),
    COALESCE(auth.uid(), NEW.created_by, OLD.created_by),
    get_current_user_role(), 'property',
    COALESCE(NEW.id, OLD.id)::text, COALESCE(NEW.title, OLD.title, ''),
    v_action, v_cat, 'imoveis', v_desc, v_old, v_new, v_changed,
    '{}', 'trigger', 'success', v_risk
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_properties
AFTER INSERT OR UPDATE OR DELETE ON properties
FOR EACH ROW EXECUTE FUNCTION audit_property_changes();

-- ================================================================
-- TRIGGER: CONTRACTS
-- ================================================================
CREATE OR REPLACE FUNCTION public.audit_contract_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_action text; v_desc text; v_changed text[]; v_old jsonb; v_new jsonb;
  v_risk text := 'medium'; v_cat text;
BEGIN
  v_changed := ARRAY[]::text[]; v_old := '{}'::jsonb; v_new := '{}'::jsonb;

  IF TG_OP = 'INSERT' THEN
    v_action := 'contract.created'; v_cat := 'create';
    v_desc := 'Contrato "' || NEW.code || '" criado (R$ ' || NEW.value || ')';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'contract.deleted'; v_cat := 'delete'; v_risk := 'critical';
    v_desc := 'Contrato "' || OLD.code || '" removido';
  ELSIF TG_OP = 'UPDATE' THEN
    v_cat := 'update';
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'contract.status_changed'; v_risk := 'high';
      v_changed := array_append(v_changed, 'status');
      v_old := jsonb_build_object('status', OLD.status); v_new := jsonb_build_object('status', NEW.status);
      v_desc := 'Contrato "' || NEW.code || '" status: ' || OLD.status || ' → ' || NEW.status;
    ELSE
      v_action := 'contract.updated';
      IF OLD.value IS DISTINCT FROM NEW.value THEN v_changed := array_append(v_changed, 'value'); v_risk := 'high'; v_old := v_old || jsonb_build_object('value', OLD.value); v_new := v_new || jsonb_build_object('value', NEW.value); END IF;
      IF OLD.broker_id IS DISTINCT FROM NEW.broker_id THEN v_changed := array_append(v_changed, 'broker_id'); END IF;
      IF OLD.commission_percentage IS DISTINCT FROM NEW.commission_percentage THEN v_changed := array_append(v_changed, 'commission_percentage'); v_risk := 'high'; END IF;
      IF array_length(v_changed, 1) IS NULL THEN RETURN NEW; END IF;
      v_desc := 'Contrato "' || NEW.code || '" atualizado (' || array_to_string(v_changed, ', ') || ')';
    END IF;
  END IF;

  PERFORM insert_audit_event(
    COALESCE(NEW.organization_id, OLD.organization_id),
    COALESCE(auth.uid(), NEW.created_by, OLD.created_by),
    get_current_user_role(), 'contract',
    COALESCE(NEW.id, OLD.id)::text, COALESCE(NEW.code, OLD.code),
    v_action, v_cat, 'contratos', v_desc, v_old, v_new, v_changed,
    '{}', 'trigger', 'success', v_risk
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_contracts
AFTER INSERT OR UPDATE OR DELETE ON contracts
FOR EACH ROW EXECUTE FUNCTION audit_contract_changes();

-- ================================================================
-- TRIGGER: USER_ROLES (role changes — high risk)
-- ================================================================
CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org_id uuid; v_name text;
BEGIN
  SELECT organization_id, full_name INTO v_org_id, v_name
  FROM profiles WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    PERFORM insert_audit_event(
      v_org_id, auth.uid(), get_current_user_role(), 'user',
      NEW.user_id::text, v_name, 'role.assigned', 'security', 'admin',
      'Role "' || NEW.role || '" atribuída para ' || COALESCE(v_name, ''),
      NULL, jsonb_build_object('role', NEW.role), ARRAY['role'],
      '{}', 'trigger', 'success', 'high', NEW.user_id
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM insert_audit_event(
      v_org_id, auth.uid(), get_current_user_role(), 'user',
      OLD.user_id::text, v_name, 'role.removed', 'security', 'admin',
      'Role "' || OLD.role || '" removida de ' || COALESCE(v_name, ''),
      jsonb_build_object('role', OLD.role), NULL, ARRAY['role'],
      '{}', 'trigger', 'success', 'high', OLD.user_id
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    PERFORM insert_audit_event(
      v_org_id, auth.uid(), get_current_user_role(), 'user',
      NEW.user_id::text, v_name, 'role.changed', 'security', 'admin',
      COALESCE(v_name, '') || ': role ' || OLD.role || ' → ' || NEW.role,
      jsonb_build_object('role', OLD.role), jsonb_build_object('role', NEW.role), ARRAY['role'],
      '{}', 'trigger', 'success', 'critical', NEW.user_id
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_roles
AFTER INSERT OR UPDATE OR DELETE ON user_roles
FOR EACH ROW EXECUTE FUNCTION audit_role_changes();

-- ================================================================
-- TRIGGER: COMMISSIONS
-- ================================================================
CREATE OR REPLACE FUNCTION public.audit_commission_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_desc text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_desc := 'Comissão de R$ ' || NEW.amount || ' (' || NEW.percentage || '%) criada';
    PERFORM insert_audit_event(NEW.organization_id, auth.uid(), get_current_user_role(),
      'commission', NEW.id::text, NULL, 'commission.created', 'create', 'financeiro', v_desc,
      NULL, NULL, NULL, '{}', 'trigger', 'success', 'medium', NULL, 'contract', NEW.contract_id::text);
  ELSIF TG_OP = 'UPDATE' THEN
    v_desc := 'Comissão atualizada';
    IF OLD.paid IS DISTINCT FROM NEW.paid AND NEW.paid = true THEN
      v_desc := 'Comissão de R$ ' || NEW.amount || ' marcada como paga';
    END IF;
    PERFORM insert_audit_event(NEW.organization_id, auth.uid(), get_current_user_role(),
      'commission', NEW.id::text, NULL, 'commission.updated', 'update', 'financeiro', v_desc,
      NULL, NULL, NULL, '{}', 'trigger', 'success', 'high', NULL, 'contract', NEW.contract_id::text);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_commissions
AFTER INSERT OR UPDATE ON commissions
FOR EACH ROW EXECUTE FUNCTION audit_commission_changes();
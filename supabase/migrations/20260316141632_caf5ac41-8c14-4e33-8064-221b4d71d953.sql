
CREATE OR REPLACE FUNCTION public.fn_dashboard_stats(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_active_properties bigint;
  v_total_properties bigint;
  v_active_leads bigint;
  v_new_leads_week bigint;
  v_active_contracts bigint;
  v_pending_contracts bigint;
  v_monthly_revenue numeric;
  v_balance numeric;
  v_now timestamptz := now();
  v_month_start timestamptz;
  v_week_ago timestamptz;
BEGIN
  v_month_start := date_trunc('month', v_now);
  v_week_ago := v_now - interval '7 days';

  SELECT 
    COUNT(*) FILTER (WHERE status IN ('disponivel', 'com_proposta', 'reservado')),
    COUNT(*)
  INTO v_active_properties, v_total_properties
  FROM properties WHERE organization_id = p_org_id;

  SELECT 
    COUNT(*) FILTER (WHERE stage NOT IN ('fechado_ganho', 'fechado_perdido') AND is_active = true),
    COUNT(*) FILTER (WHERE created_at >= v_week_ago AND is_active = true)
  INTO v_active_leads, v_new_leads_week
  FROM leads WHERE organization_id = p_org_id;

  SELECT 
    COUNT(*) FILTER (WHERE status = 'ativo'),
    COUNT(*) FILTER (WHERE status = 'rascunho')
  INTO v_active_contracts, v_pending_contracts
  FROM contracts WHERE organization_id = p_org_id;

  SELECT 
    COALESCE(SUM(CASE WHEN type = 'receita' AND date >= v_month_start AND date < v_month_start + interval '1 month' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN paid = true THEN (CASE WHEN type = 'receita' THEN amount ELSE -amount END) ELSE 0 END), 0)
  INTO v_monthly_revenue, v_balance
  FROM transactions WHERE organization_id = p_org_id;

  RETURN jsonb_build_object(
    'active_properties', v_active_properties,
    'total_properties', v_total_properties,
    'active_leads', v_active_leads,
    'new_leads_week', v_new_leads_week,
    'active_contracts', v_active_contracts,
    'pending_contracts', v_pending_contracts,
    'monthly_revenue', v_monthly_revenue,
    'balance', v_balance
  );
END;
$$;

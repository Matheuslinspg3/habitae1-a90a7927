
-- RPC: fn_kpi_metrics - returns KPIs for a given org and date range
CREATE OR REPLACE FUNCTION public.fn_kpi_metrics(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_leads_count bigint;
  v_visits_count bigint;
  v_proposals_count bigint;
  v_closings_count bigint;
  v_avg_ticket numeric;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
  v_prev_leads bigint;
  v_prev_visits bigint;
  v_prev_proposals bigint;
  v_prev_closings bigint;
  v_prev_avg_ticket numeric;
  v_proposal_stage_ids uuid[];
  v_win_stage_ids uuid[];
BEGIN
  -- Calculate previous period (same duration, immediately before)
  v_prev_end := p_start;
  v_prev_start := p_start - (p_end - p_start);

  -- Get proposal and win stage IDs
  SELECT array_agg(id) INTO v_proposal_stage_ids
  FROM lead_stages
  WHERE organization_id = p_org_id AND lower(name) LIKE '%propost%';

  SELECT array_agg(id) INTO v_win_stage_ids
  FROM lead_stages
  WHERE organization_id = p_org_id AND is_win = true;

  -- Current period metrics
  SELECT COUNT(*) INTO v_leads_count
  FROM leads WHERE organization_id = p_org_id AND created_at >= p_start AND created_at < p_end AND is_active = true;

  SELECT COUNT(*) INTO v_visits_count
  FROM appointments WHERE organization_id = p_org_id AND start_time >= p_start AND start_time < p_end AND completed = true;

  SELECT COUNT(*) INTO v_proposals_count
  FROM leads WHERE organization_id = p_org_id AND lead_stage_id = ANY(COALESCE(v_proposal_stage_ids, ARRAY[]::uuid[])) AND is_active = true AND updated_at >= p_start AND updated_at < p_end;

  SELECT COUNT(*) INTO v_closings_count
  FROM contracts WHERE organization_id = p_org_id AND created_at >= p_start AND created_at < p_end;

  SELECT COALESCE(AVG(value), 0) INTO v_avg_ticket
  FROM contracts WHERE organization_id = p_org_id AND created_at >= p_start AND created_at < p_end;

  -- Previous period metrics
  SELECT COUNT(*) INTO v_prev_leads
  FROM leads WHERE organization_id = p_org_id AND created_at >= v_prev_start AND created_at < v_prev_end AND is_active = true;

  SELECT COUNT(*) INTO v_prev_visits
  FROM appointments WHERE organization_id = p_org_id AND start_time >= v_prev_start AND start_time < v_prev_end AND completed = true;

  SELECT COUNT(*) INTO v_prev_proposals
  FROM leads WHERE organization_id = p_org_id AND lead_stage_id = ANY(COALESCE(v_proposal_stage_ids, ARRAY[]::uuid[])) AND is_active = true AND updated_at >= v_prev_start AND updated_at < v_prev_end;

  SELECT COUNT(*) INTO v_prev_closings
  FROM contracts WHERE organization_id = p_org_id AND created_at >= v_prev_start AND created_at < v_prev_end;

  SELECT COALESCE(AVG(value), 0) INTO v_prev_avg_ticket
  FROM contracts WHERE organization_id = p_org_id AND created_at >= v_prev_start AND created_at < v_prev_end;

  RETURN jsonb_build_object(
    'leads', v_leads_count,
    'visits', v_visits_count,
    'proposals', v_proposals_count,
    'closings', v_closings_count,
    'conversion_rate', CASE WHEN v_leads_count > 0 THEN ROUND((v_closings_count::numeric / v_leads_count) * 100, 1) ELSE 0 END,
    'avg_ticket', ROUND(v_avg_ticket, 2),
    'prev_leads', v_prev_leads,
    'prev_visits', v_prev_visits,
    'prev_proposals', v_prev_proposals,
    'prev_closings', v_prev_closings,
    'prev_conversion_rate', CASE WHEN v_prev_leads > 0 THEN ROUND((v_prev_closings::numeric / v_prev_leads) * 100, 1) ELSE 0 END,
    'prev_avg_ticket', ROUND(v_prev_avg_ticket, 2)
  );
END;
$$;

-- RPC: fn_agent_ranking - returns broker metrics for ranking
CREATE OR REPLACE FUNCTION public.fn_agent_ranking(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.closings DESC, t.active_leads DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      p.user_id,
      p.full_name,
      p.avatar_url,
      (SELECT COUNT(*) FROM leads l WHERE l.broker_id = p.user_id AND l.organization_id = p_org_id AND l.is_active = true) as active_leads,
      (SELECT COUNT(*) FROM appointments a WHERE a.assigned_to = p.user_id AND a.organization_id = p_org_id AND a.completed = true AND a.start_time >= p_start AND a.start_time < p_end) as visits,
      (SELECT COUNT(*) FROM contracts c WHERE c.broker_id = p.user_id AND c.organization_id = p_org_id AND c.created_at >= p_start AND c.created_at < p_end) as closings,
      (SELECT COUNT(*) FROM lead_interactions li JOIN leads l ON l.id = li.lead_id WHERE li.created_by = p.user_id AND l.organization_id = p_org_id AND li.created_at >= p_start AND li.created_at < p_end) as interactions,
      (SELECT EXTRACT(EPOCH FROM AVG(li.created_at - l.created_at)) / 3600
       FROM lead_interactions li JOIN leads l ON l.id = li.lead_id
       WHERE li.created_by = p.user_id AND l.organization_id = p_org_id
         AND li.created_at >= p_start AND li.created_at < p_end
         AND li.id = (SELECT id FROM lead_interactions WHERE lead_id = l.id ORDER BY created_at ASC LIMIT 1)
      ) as avg_response_hours
    FROM profiles p
    JOIN user_roles ur ON ur.user_id = p.user_id
    WHERE p.organization_id = p_org_id
      AND ur.role IN ('corretor', 'admin', 'sub_admin', 'leader')
  ) t;

  RETURN result;
END;
$$;

-- RPC: fn_funnel_detail - returns leads count per stage with advancement rates
CREATE OR REPLACE FUNCTION public.fn_funnel_detail(
  p_org_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.position), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      ls.id as stage_id,
      ls.name,
      ls.color,
      ls.position,
      ls.is_win,
      ls.is_loss,
      (SELECT COUNT(*) FROM leads l WHERE l.lead_stage_id = ls.id AND l.organization_id = p_org_id AND l.is_active = true) as count
    FROM lead_stages ls
    WHERE ls.organization_id = p_org_id
  ) t;

  RETURN result;
END;
$$;

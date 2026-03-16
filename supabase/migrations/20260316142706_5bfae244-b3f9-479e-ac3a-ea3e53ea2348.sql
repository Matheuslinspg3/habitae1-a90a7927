CREATE OR REPLACE FUNCTION public.fn_pipeline_summary(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stages jsonb;
  v_inactive jsonb;
  v_overall_rate numeric;
  v_total_active bigint;
  v_total_won bigint;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.position), '[]'::jsonb)
  INTO v_stages
  FROM (
    SELECT
      ls.id,
      ls.name,
      ls.color,
      ls.position,
      ls.is_win,
      ls.is_loss,
      COALESCE(cnt.count, 0) AS count,
      COALESCE(cnt.total_value, 0) AS total_value
    FROM lead_stages ls
    LEFT JOIN (
      SELECT lead_stage_id, COUNT(*) AS count, COALESCE(SUM(estimated_value), 0) AS total_value
      FROM leads
      WHERE organization_id = p_org_id AND is_active = true
      GROUP BY lead_stage_id
    ) cnt ON cnt.lead_stage_id = ls.id
    WHERE ls.organization_id = p_org_id
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.days_inactive DESC), '[]'::jsonb)
  INTO v_inactive
  FROM (
    SELECT
      l.id,
      l.name,
      EXTRACT(DAY FROM now() - l.updated_at)::int AS days_inactive
    FROM leads l
    JOIN lead_stages ls ON ls.id = l.lead_stage_id
    WHERE l.organization_id = p_org_id
      AND l.is_active = true
      AND ls.is_win = false
      AND ls.is_loss = false
      AND l.updated_at < now() - interval '5 days'
    ORDER BY l.updated_at ASC
    LIMIT 10
  ) t;

  SELECT COUNT(*) INTO v_total_active
  FROM leads WHERE organization_id = p_org_id AND is_active = true;

  SELECT COUNT(*) INTO v_total_won
  FROM leads l
  JOIN lead_stages ls ON ls.id = l.lead_stage_id
  WHERE l.organization_id = p_org_id AND l.is_active = true AND ls.is_win = true;

  v_overall_rate := CASE WHEN v_total_active > 0 
    THEN ROUND((v_total_won::numeric / v_total_active) * 100, 1) 
    ELSE 0 END;

  RETURN jsonb_build_object(
    'stages', v_stages,
    'inactive_leads', v_inactive,
    'total_active', v_total_active,
    'total_won', v_total_won,
    'overall_rate', v_overall_rate
  );
END;
$$;
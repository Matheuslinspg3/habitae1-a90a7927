
CREATE OR REPLACE FUNCTION public.admin_get_org_usage()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  IF NOT is_system_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT 
      o.id,
      o.name,
      o.type,
      o.created_at,
      (SELECT COUNT(*) FROM properties p WHERE p.organization_id = o.id) as total_properties,
      (SELECT COUNT(*) FROM properties p WHERE p.organization_id = o.id AND p.status = 'disponivel') as active_properties,
      (SELECT COUNT(*) FROM leads l WHERE l.organization_id = o.id) as total_leads,
      (SELECT COUNT(*) FROM contracts c WHERE c.organization_id = o.id) as total_contracts,
      (SELECT COUNT(*) FROM profiles pr WHERE pr.organization_id = o.id) as total_users,
      (SELECT COUNT(*) FROM property_images pi 
       JOIN properties p ON pi.property_id = p.id 
       WHERE p.organization_id = o.id) as total_images,
      (SELECT COUNT(*) FROM property_media pm WHERE pm.organization_id = o.id) as total_media,
      (SELECT COALESCE(SUM(pm.file_size_bytes), 0) FROM property_media pm WHERE pm.organization_id = o.id) as storage_bytes,
      (SELECT COUNT(*) FROM tasks tk WHERE tk.organization_id = o.id) as total_tasks,
      (SELECT COUNT(*) FROM appointments ap WHERE ap.organization_id = o.id) as total_appointments,
      (SELECT COUNT(*) FROM invoices inv WHERE inv.organization_id = o.id) as total_invoices,
      (SELECT COUNT(*) FROM marketplace_properties mp WHERE mp.organization_id = o.id) as total_marketplace
    FROM organizations o
    ORDER BY total_properties DESC
  ) t INTO result;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;

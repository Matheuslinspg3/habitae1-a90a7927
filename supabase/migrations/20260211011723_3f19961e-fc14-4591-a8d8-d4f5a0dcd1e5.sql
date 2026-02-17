CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_invite RECORD;
  v_full_name TEXT;
  v_phone TEXT;
  v_account_type TEXT;
  v_company_name TEXT;
BEGIN
  -- Extrair metadata do usuário
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario');
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_account_type := COALESCE(NEW.raw_user_meta_data->>'account_type', 'corretor_individual');
  v_company_name := NEW.raw_user_meta_data->>'company_name';
  
  -- Verificar se há convite pendente
  SELECT * INTO v_invite 
  FROM public.organization_invites 
  WHERE email = LOWER(NEW.email) AND status = 'pending'
  LIMIT 1;
  
  IF v_invite IS NOT NULL THEN
    v_org_id := v_invite.organization_id;
    
    INSERT INTO public.profiles (user_id, organization_id, full_name, phone)
    VALUES (NEW.id, v_org_id, v_full_name, v_phone);
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, v_invite.role);
    
    UPDATE public.organization_invites 
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_invite.id;
  ELSE
    INSERT INTO public.organizations (name, type, email, created_by)
    VALUES (
      CASE 
        WHEN v_account_type = 'imobiliaria' AND v_company_name IS NOT NULL 
        THEN v_company_name 
        ELSE v_full_name 
      END,
      CASE 
        WHEN v_account_type = 'imobiliaria' THEN 'imobiliaria'::organization_type 
        ELSE 'corretor_individual'::organization_type 
      END,
      NEW.email,
      NEW.id
    )
    RETURNING id INTO v_org_id;
    
    INSERT INTO public.profiles (user_id, organization_id, full_name, phone)
    VALUES (NEW.id, v_org_id, v_full_name, v_phone);
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  END IF;
  
  RETURN NEW;
END;
$function$;
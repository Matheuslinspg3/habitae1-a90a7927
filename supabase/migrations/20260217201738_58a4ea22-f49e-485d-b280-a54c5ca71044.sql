-- Fix fix_user_without_organization: remove organization_id from user_roles insert
CREATE OR REPLACE FUNCTION public.fix_user_without_organization(p_user_id uuid, p_email text, p_full_name text DEFAULT 'Usuario'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id UUID;
  v_existing_profile RECORD;
BEGIN
  -- Verificar se já tem perfil com organização
  SELECT * INTO v_existing_profile FROM public.profiles WHERE user_id = p_user_id;
  
  IF v_existing_profile IS NOT NULL AND v_existing_profile.organization_id IS NOT NULL THEN
    RETURN v_existing_profile.organization_id;
  END IF;
  
  -- Criar organização
  INSERT INTO public.organizations (name, type, email, created_by)
  VALUES (p_full_name, 'corretor_individual', p_email, p_user_id)
  RETURNING id INTO v_org_id;
  
  IF v_existing_profile IS NOT NULL THEN
    -- Atualizar perfil existente
    UPDATE public.profiles SET organization_id = v_org_id WHERE user_id = p_user_id;
  ELSE
    -- Criar perfil
    INSERT INTO public.profiles (user_id, organization_id, full_name)
    VALUES (p_user_id, v_org_id, p_full_name);
  END IF;
  
  -- Criar role admin se não existir (user_roles has no organization_id column)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'admin')
  ON CONFLICT DO NOTHING;
  
  RETURN v_org_id;
END;
$function$;
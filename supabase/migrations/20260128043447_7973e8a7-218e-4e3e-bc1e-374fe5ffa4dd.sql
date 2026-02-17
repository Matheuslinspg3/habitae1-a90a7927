-- ===========================================
-- TRIGGER PARA CRIAR ORGANIZAÇÃO AUTOMATICAMENTE
-- ===========================================

-- Função que cria organização, perfil e role quando novo usuário é criado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Usuário convidado: vincular à organização existente
    v_org_id := v_invite.organization_id;
    
    -- Criar perfil vinculado
    INSERT INTO public.profiles (user_id, organization_id, full_name, phone)
    VALUES (NEW.id, v_org_id, v_full_name, v_phone);
    
    -- Criar role do convite (não admin)
    INSERT INTO public.user_roles (user_id, organization_id, role)
    VALUES (NEW.id, v_org_id, v_invite.role);
    
    -- Marcar convite como aceito
    UPDATE public.organization_invites 
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_invite.id;
  ELSE
    -- Novo usuário: criar organização própria
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
    
    -- Criar perfil vinculado
    INSERT INTO public.profiles (user_id, organization_id, full_name, phone)
    VALUES (NEW.id, v_org_id, v_full_name, v_phone);
    
    -- Criar role de admin
    INSERT INTO public.user_roles (user_id, organization_id, role)
    VALUES (NEW.id, v_org_id, 'admin');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger que executa APÓS inserção de novo usuário
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================
-- CORRIGIR POLÍTICAS RLS PROBLEMÁTICAS
-- ===========================================

-- Remover política antiga de user_roles que tenta acessar auth.users
DROP POLICY IF EXISTS "Users can create their own initial role or admins can add membe" ON public.user_roles;
DROP POLICY IF EXISTS "Users can create their own initial role or admins can add members" ON public.user_roles;

-- Nova política simplificada: apenas admins podem adicionar roles (trigger cuida do signup)
CREATE POLICY "Admins can add roles to their organization"
ON public.user_roles FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id() 
  AND is_org_admin(auth.uid())
);

-- Remover políticas problemáticas de organization_invites
DROP POLICY IF EXISTS "Users can accept their own invites or admins can manage" ON public.organization_invites;
DROP POLICY IF EXISTS "Users can view invites for their email" ON public.organization_invites;

-- Política simplificada para UPDATE de convites (trigger já aceita durante signup)
CREATE POLICY "Admins can update invites in their organization"
ON public.organization_invites FOR UPDATE
USING (organization_id = get_user_organization_id() AND is_org_admin(auth.uid()));

-- ===========================================
-- CORRIGIR USUÁRIOS EXISTENTES SEM ORGANIZAÇÃO
-- ===========================================

-- Função para corrigir usuários legados (pode ser chamada manualmente se necessário)
CREATE OR REPLACE FUNCTION public.fix_user_without_organization(p_user_id UUID, p_email TEXT, p_full_name TEXT DEFAULT 'Usuario')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Criar role admin se não existir
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (p_user_id, v_org_id, 'admin')
  ON CONFLICT DO NOTHING;
  
  RETURN v_org_id;
END;
$$;
-- ============================================
-- Corrigir política RLS para user_roles
-- Permitir que usuários criem sua própria role inicial durante signup
-- ============================================

-- Remover política antiga que exige ser admin
DROP POLICY IF EXISTS "Admins can manage roles in their organization" ON public.user_roles;

-- Nova política: permite criar role se:
-- 1. O próprio usuário está criando o role E é o criador da organização (signup)
-- 2. OU é um admin adicionando membro à sua organização
CREATE POLICY "Users can create their own initial role or admins can add members"
ON public.user_roles FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (
    -- Usuário é o criador da organização (signup)
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id
      AND o.created_by = auth.uid()
    )
    OR
    -- Usuário está sendo convidado para organização (convite aceito)
    EXISTS (
      SELECT 1 FROM public.organization_invites oi
      WHERE oi.organization_id = user_roles.organization_id
      AND oi.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND oi.status = 'pending'
    )
  )
  OR
  -- Admin adicionando novo membro
  (
    organization_id = get_user_organization_id() 
    AND is_org_admin(auth.uid())
  )
);

-- Política para permitir que usuários atualizem convites (aceitar convite)
DROP POLICY IF EXISTS "Admins can update invites" ON public.organization_invites;

CREATE POLICY "Users can accept their own invites or admins can manage"
ON public.organization_invites FOR UPDATE
USING (
  -- Usuário aceitando seu próprio convite
  (email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND status = 'pending')
  OR
  -- Admin gerenciando convites da organização
  (organization_id = get_user_organization_id() AND is_org_admin(auth.uid()))
);

-- Política para usuários verem convites destinados a eles (para verificar durante signup)
CREATE POLICY "Users can view invites for their email"
ON public.organization_invites FOR SELECT
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR
  organization_id = get_user_organization_id()
);
-- Tenant-scoped RBAC hardening
-- Introduz has_role_in_org(user_id, org_id, role) e migra policies administrativas para contexto de tenant.

CREATE OR REPLACE FUNCTION public.has_role_in_org(_user_id uuid, _org_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.organization_id = _org_id
      AND ur.role = _role
  )
$$;

-- user_roles: garantir escopo por tenant para leitura/escrita de papéis
DROP POLICY IF EXISTS "Users view own or dev/leader see all" ON public.user_roles;
DROP POLICY IF EXISTS "Dev or leader can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Dev or leader can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Dev or leader can delete roles" ON public.user_roles;

CREATE POLICY "Users view own or tenant managers see all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (
    user_id = auth.uid()
    OR public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
  )
);

CREATE POLICY "Tenant managers can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role_in_org(auth.uid(), public.get_user_organization_id(), 'developer'::app_role)
    OR public.has_role_in_org(auth.uid(), public.get_user_organization_id(), 'leader'::app_role)
  )
);

CREATE POLICY "Tenant managers can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
  )
)
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role_in_org(auth.uid(), public.get_user_organization_id(), 'developer'::app_role)
    OR public.has_role_in_org(auth.uid(), public.get_user_organization_id(), 'leader'::app_role)
  )
);

CREATE POLICY "Tenant managers can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
  )
);

-- Commissions
DROP POLICY IF EXISTS "Users can view commissions in their organization" ON public.commissions;
CREATE POLICY "Users can view commissions in their organization"
ON public.commissions
FOR SELECT
USING (
  organization_id = public.get_user_organization_id()
  AND (
    broker_id = auth.uid()
    OR public.has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

-- Invoices
DROP POLICY IF EXISTS "Managers can view invoices in their organization" ON public.invoices;
DROP POLICY IF EXISTS "Managers can update invoices in their organization" ON public.invoices;
DROP POLICY IF EXISTS "Managers can create invoices" ON public.invoices;

CREATE POLICY "Managers can view invoices in their organization"
ON public.invoices
FOR SELECT
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

CREATE POLICY "Managers can update invoices in their organization"
ON public.invoices
FOR UPDATE
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
)
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

CREATE POLICY "Managers can create invoices"
ON public.invoices
FOR INSERT
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role_in_org(auth.uid(), public.get_user_organization_id(), 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), public.get_user_organization_id(), 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), public.get_user_organization_id(), 'developer'::app_role)
  )
);

-- Transactions
DROP POLICY IF EXISTS "Managers can view transactions in their organization" ON public.transactions;
DROP POLICY IF EXISTS "Managers can update transactions in their organization" ON public.transactions;
DROP POLICY IF EXISTS "Managers can create transactions" ON public.transactions;

CREATE POLICY "Managers can view transactions in their organization"
ON public.transactions
FOR SELECT
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

CREATE POLICY "Managers can update transactions in their organization"
ON public.transactions
FOR UPDATE
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
)
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

CREATE POLICY "Managers can create transactions"
ON public.transactions
FOR INSERT
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role_in_org(auth.uid(), public.get_user_organization_id(), 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), public.get_user_organization_id(), 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), public.get_user_organization_id(), 'developer'::app_role)
  )
);

-- Organization invites
DROP POLICY IF EXISTS "Admins and leaders can insert invites" ON public.organization_invites;
CREATE POLICY "Admins and leaders can insert invites"
ON public.organization_invites
FOR INSERT
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role_in_org(auth.uid(), public.get_user_organization_id(), 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), public.get_user_organization_id(), 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), public.get_user_organization_id(), 'developer'::app_role)
  )
);

-- Validar se restaram policies privilegiadas sem escopo de tenant
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN ('user_roles', 'commissions', 'invoices', 'transactions', 'organization_invites')
    AND (
      coalesce(p.qual, '') ~ 'has_role\(auth\.uid\(\),'
      OR coalesce(p.with_check, '') ~ 'has_role\(auth\.uid\(\),'
    )
    AND NOT (
      coalesce(p.qual, '') ~ 'organization_id\s*=\s*get_user_organization_id\(\)'
      OR coalesce(p.with_check, '') ~ 'organization_id\s*=\s*get_user_organization_id\(\)'
      OR coalesce(p.qual, '') ~ 'has_role_in_org\('
      OR coalesce(p.with_check, '') ~ 'has_role_in_org\('
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Foram encontradas % policy(s) privilegiadas sem filtro de tenant em pg_policies.', v_count;
  END IF;
END;
$$;

-- Organization-scoped RBAC hardening

-- 1) New helper for org-scoped role checks
CREATE OR REPLACE FUNCTION public.has_role_in_org(
  _user_id uuid,
  _org_id uuid,
  _role app_role
)
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
  );
$$;

-- 2) Recreate user_roles policies with strict org predicate
DROP POLICY IF EXISTS "Developers can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Dev or leader can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Developers can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Dev or leader can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Developers can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Dev or leader can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles or developers see all" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own or dev/leader see all" ON public.user_roles;

CREATE POLICY "Users can view org-scoped roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (
    user_id = auth.uid()
    OR public.has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

CREATE POLICY "Managers can insert org-scoped roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

CREATE POLICY "Managers can update org-scoped roles"
ON public.user_roles
FOR UPDATE
TO authenticated
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

CREATE POLICY "Managers can delete org-scoped roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

-- 3) Update admin-table policies from global role checks to org-scoped checks

-- organization_invites
DROP POLICY IF EXISTS "Leaders can insert invites" ON public.organization_invites;
CREATE POLICY "Leaders can insert invites"
ON public.organization_invites
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
);

-- platform_invites
DROP POLICY IF EXISTS "Developers and leaders can manage platform invites" ON public.platform_invites;
CREATE POLICY "Developers and leaders can manage platform invites"
ON public.platform_invites
FOR ALL
TO authenticated
USING (
  public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
)
WITH CHECK (
  public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
);

-- contracts
DROP POLICY IF EXISTS "Users can view contracts by role" ON public.contracts;
DROP POLICY IF EXISTS "Users can update contracts by role" ON public.contracts;

CREATE POLICY "Users can view contracts by role"
ON public.contracts
FOR SELECT
TO authenticated
USING (
  is_member_of_org(organization_id)
  AND (
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
    OR broker_id = auth.uid()
  )
);

CREATE POLICY "Users can update contracts by role"
ON public.contracts
FOR UPDATE
TO authenticated
USING (
  is_member_of_org(organization_id)
  AND (
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR broker_id = auth.uid()
  )
);

-- commissions/invoices/transactions
DROP POLICY IF EXISTS "Users can view commissions in their organization" ON public.commissions;
CREATE POLICY "Users can view commissions in their organization"
ON public.commissions
FOR SELECT
USING (
  is_member_of_org(organization_id)
  AND (
    broker_id = auth.uid()
    OR public.has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

DROP POLICY IF EXISTS "Managers can view invoices in their organization" ON public.invoices;
DROP POLICY IF EXISTS "Managers can update invoices in their organization" ON public.invoices;
DROP POLICY IF EXISTS "Managers can create invoices" ON public.invoices;

CREATE POLICY "Managers can view invoices in their organization"
ON public.invoices
FOR SELECT
USING (
  is_member_of_org(organization_id)
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
  is_member_of_org(organization_id)
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
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

DROP POLICY IF EXISTS "Managers can view transactions in their organization" ON public.transactions;
DROP POLICY IF EXISTS "Managers can update transactions in their organization" ON public.transactions;
DROP POLICY IF EXISTS "Managers can create transactions" ON public.transactions;

CREATE POLICY "Managers can view transactions in their organization"
ON public.transactions
FOR SELECT
USING (
  is_member_of_org(organization_id)
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
  is_member_of_org(organization_id)
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
    public.has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR public.has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

-- Validation queries (execute manually after migration)
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('user_roles','organization_invites','platform_invites','contracts','commissions','invoices','transactions')
-- ORDER BY tablename, policyname;
--
-- Manual test (as authenticated org member):
-- 1) INSERT with own organization_id should succeed for manager roles.
-- 2) INSERT with a different organization_id should fail due to RLS.

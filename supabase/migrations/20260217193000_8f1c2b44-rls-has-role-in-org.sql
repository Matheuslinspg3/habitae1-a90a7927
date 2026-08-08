-- Add org-scoped role helper and migrate critical admin RLS policies

CREATE OR REPLACE FUNCTION public.has_role_in_org(_user_id uuid, _organization_id uuid, _role app_role)
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
      AND ur.organization_id = _organization_id
      AND ur.role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_role(_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role_in_org(auth.uid(), public.get_user_organization_id(), _role);
$$;

-- user_roles
DROP POLICY IF EXISTS "Dev or leader can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Dev or leader can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Dev or leader can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own or dev/leader see all" ON public.user_roles;

CREATE POLICY "Users view own or dev/leader see all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND (
    user_id = auth.uid()
    OR has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
  )
);

CREATE POLICY "Dev or leader can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
  )
);

CREATE POLICY "Dev or leader can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
  )
);

CREATE POLICY "Dev or leader can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
  )
);

-- platform_invites
DROP POLICY IF EXISTS "Developers and leaders can manage platform invites" ON public.platform_invites;

CREATE POLICY "Developers and leaders can manage platform invites"
ON public.platform_invites
FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
  )
);

-- organization_invites
DROP POLICY IF EXISTS "Admins and leaders can insert invites" ON public.organization_invites;

CREATE POLICY "Admins and leaders can insert invites"
ON public.organization_invites
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

-- leads
DROP POLICY IF EXISTS "Users can view leads based on role" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads based on role" ON public.leads;

CREATE POLICY "Users can view leads based on role"
ON public.leads
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
    OR broker_id = auth.uid()
  )
);

CREATE POLICY "Users can update leads based on role"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
    OR broker_id = auth.uid()
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
    OR broker_id = auth.uid()
  )
);

-- contracts
DROP POLICY IF EXISTS "Users can view contracts by role" ON public.contracts;
DROP POLICY IF EXISTS "Users can update contracts by role" ON public.contracts;

CREATE POLICY "Users can view contracts by role"
ON public.contracts
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
    OR broker_id = auth.uid()
  )
);

CREATE POLICY "Users can update contracts by role"
ON public.contracts
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR broker_id = auth.uid()
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR broker_id = auth.uid()
  )
);

-- financial admin tables
DROP POLICY IF EXISTS "Users can view commissions in their organization" ON public.commissions;
CREATE POLICY "Users can view commissions in their organization"
ON public.commissions
FOR SELECT
USING (
  organization_id = get_user_organization_id()
  AND (
    broker_id = auth.uid()
    OR has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

DROP POLICY IF EXISTS "Managers can view invoices in their organization" ON public.invoices;
DROP POLICY IF EXISTS "Managers can update invoices in their organization" ON public.invoices;
DROP POLICY IF EXISTS "Managers can create invoices" ON public.invoices;

CREATE POLICY "Managers can view invoices in their organization"
ON public.invoices
FOR SELECT
USING (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

CREATE POLICY "Managers can update invoices in their organization"
ON public.invoices
FOR UPDATE
USING (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

CREATE POLICY "Managers can create invoices"
ON public.invoices
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

DROP POLICY IF EXISTS "Managers can view transactions in their organization" ON public.transactions;
DROP POLICY IF EXISTS "Managers can update transactions in their organization" ON public.transactions;
DROP POLICY IF EXISTS "Managers can create transactions" ON public.transactions;

CREATE POLICY "Managers can view transactions in their organization"
ON public.transactions
FOR SELECT
USING (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

CREATE POLICY "Managers can update transactions in their organization"
ON public.transactions
FOR UPDATE
USING (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

CREATE POLICY "Managers can create transactions"
ON public.transactions
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    has_role_in_org(auth.uid(), organization_id, 'admin'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'leader'::app_role)
    OR has_role_in_org(auth.uid(), organization_id, 'developer'::app_role)
  )
);

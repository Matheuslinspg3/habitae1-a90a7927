
-- ================================================================
-- SECURITY: Restrict financial data visibility
-- ================================================================

-- #1 Commissions: brokers see only their own; admin/leader/dev see all
DROP POLICY IF EXISTS "Users can view commissions in their organization" ON public.commissions;

CREATE POLICY "Users can view commissions in their organization"
ON public.commissions
FOR SELECT
USING (
  is_member_of_org(organization_id)
  AND (
    broker_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'leader')
    OR has_role(auth.uid(), 'developer')
  )
);

-- #2 Invoices: restrict to admin/leader/dev
DROP POLICY IF EXISTS "Users can view invoices in their organization" ON public.invoices;

CREATE POLICY "Managers can view invoices in their organization"
ON public.invoices
FOR SELECT
USING (
  is_member_of_org(organization_id)
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'leader')
    OR has_role(auth.uid(), 'developer')
  )
);

-- Also restrict invoice updates to managers
DROP POLICY IF EXISTS "Users can update invoices in their organization" ON public.invoices;

CREATE POLICY "Managers can update invoices in their organization"
ON public.invoices
FOR UPDATE
USING (
  is_member_of_org(organization_id)
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'leader')
    OR has_role(auth.uid(), 'developer')
  )
);

-- Restrict invoice creation to managers
DROP POLICY IF EXISTS "Users can create invoices" ON public.invoices;

CREATE POLICY "Managers can create invoices"
ON public.invoices
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'leader')
    OR has_role(auth.uid(), 'developer')
  )
);

-- #3 Transactions: restrict to admin/leader/dev
DROP POLICY IF EXISTS "Users can view transactions in their organization" ON public.transactions;

CREATE POLICY "Managers can view transactions in their organization"
ON public.transactions
FOR SELECT
USING (
  is_member_of_org(organization_id)
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'leader')
    OR has_role(auth.uid(), 'developer')
  )
);

-- Restrict transaction updates to managers
DROP POLICY IF EXISTS "Users can update transactions in their organization" ON public.transactions;

CREATE POLICY "Managers can update transactions in their organization"
ON public.transactions
FOR UPDATE
USING (
  is_member_of_org(organization_id)
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'leader')
    OR has_role(auth.uid(), 'developer')
  )
);

-- Restrict transaction creation to managers
DROP POLICY IF EXISTS "Users can create transactions" ON public.transactions;

CREATE POLICY "Managers can create transactions"
ON public.transactions
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'leader')
    OR has_role(auth.uid(), 'developer')
  )
);

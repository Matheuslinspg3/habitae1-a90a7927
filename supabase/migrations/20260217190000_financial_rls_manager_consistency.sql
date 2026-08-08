-- Align financial UPDATE/SELECT policies with manager-role checks
-- Scope reviewed: billing_payments, subscriptions, transactions, invoices

-- ================================================================
-- 1) billing_payments: replace UPDATE policy with member + manager role
-- ================================================================
DROP POLICY IF EXISTS "Only admins can update payments" ON public.billing_payments;
DROP POLICY IF EXISTS "Org admins can update payments" ON public.billing_payments;
DROP POLICY IF EXISTS "Managers can update billing payments" ON public.billing_payments;

CREATE POLICY "Managers can update billing payments"
ON public.billing_payments
FOR UPDATE
TO authenticated
USING (
  is_member_of_org(organization_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
  )
)
WITH CHECK (
  is_member_of_org(organization_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
  )
);

-- ================================================================
-- 2) subscriptions: tighten SELECT visibility for consistency
-- ================================================================
DROP POLICY IF EXISTS "Organizations can view their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Managers can view subscriptions in their organization" ON public.subscriptions;

CREATE POLICY "Managers can view subscriptions in their organization"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  is_member_of_org(organization_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
  )
);

-- ================================================================
-- 3) invoices and transactions: ensure UPDATE policies have WITH CHECK
-- ================================================================
DROP POLICY IF EXISTS "Managers can update invoices in their organization" ON public.invoices;
CREATE POLICY "Managers can update invoices in their organization"
ON public.invoices
FOR UPDATE
TO authenticated
USING (
  is_member_of_org(organization_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
  )
)
WITH CHECK (
  is_member_of_org(organization_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
  )
);

DROP POLICY IF EXISTS "Managers can update transactions in their organization" ON public.transactions;
CREATE POLICY "Managers can update transactions in their organization"
ON public.transactions
FOR UPDATE
TO authenticated
USING (
  is_member_of_org(organization_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
  )
)
WITH CHECK (
  is_member_of_org(organization_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'leader'::app_role)
    OR has_role(auth.uid(), 'developer'::app_role)
  )
);

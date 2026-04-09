-- Harden platform_invites RLS with explicit CRUD policies and tenant predicates

-- Dedicated role for platform invite issuance (avoid relying on generic leader role)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_inviter';

-- Remove broad legacy policy
DROP POLICY IF EXISTS "Developers and leaders can manage platform invites" ON public.platform_invites;

-- SELECT: only scoped managers can read invites from their own tenant
CREATE POLICY "Platform invite managers can view own tenant invites"
ON public.platform_invites
FOR SELECT
TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'developer'::public.app_role)
    OR public.has_role(auth.uid(), 'platform_inviter'::public.app_role)
  )
  AND organization_id = public.get_user_organization_id()
);

-- INSERT: enforce tenant ownership via WITH CHECK
CREATE POLICY "Platform invite managers can create own tenant invites"
ON public.platform_invites
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.has_role(auth.uid(), 'developer'::public.app_role)
    OR public.has_role(auth.uid(), 'platform_inviter'::public.app_role)
  )
  AND organization_id = public.get_user_organization_id()
);

-- UPDATE: enforce tenant ownership for source row (USING) and target row (WITH CHECK)
CREATE POLICY "Platform invite managers can update own tenant invites"
ON public.platform_invites
FOR UPDATE
TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'developer'::public.app_role)
    OR public.has_role(auth.uid(), 'platform_inviter'::public.app_role)
  )
  AND organization_id = public.get_user_organization_id()
)
WITH CHECK (
  (
    public.has_role(auth.uid(), 'developer'::public.app_role)
    OR public.has_role(auth.uid(), 'platform_inviter'::public.app_role)
  )
  AND organization_id = public.get_user_organization_id()
);

-- DELETE: only allow deleting rows from caller tenant
CREATE POLICY "Platform invite managers can delete own tenant invites"
ON public.platform_invites
FOR DELETE
TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'developer'::public.app_role)
    OR public.has_role(auth.uid(), 'platform_inviter'::public.app_role)
  )
  AND organization_id = public.get_user_organization_id()
);

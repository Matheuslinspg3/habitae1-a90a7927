-- Ensure role checks can be scoped to a specific organization/tenant
CREATE OR REPLACE FUNCTION public.has_role_in_organization(
  _user_id uuid,
  _organization_id uuid,
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
    FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _organization_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_role_in_organization(
  _organization_id uuid,
  _role app_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role_in_organization(auth.uid(), _organization_id, _role)
$$;

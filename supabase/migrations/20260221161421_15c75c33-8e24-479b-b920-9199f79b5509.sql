-- Drop the org-scoped developer policy
DROP POLICY IF EXISTS "Developers can view org profiles" ON public.profiles;

-- Create a new policy that lets developers see ALL profiles across orgs
CREATE POLICY "Developers can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (current_user_has_role('developer'::app_role));
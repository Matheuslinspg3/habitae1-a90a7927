
-- 1. Fix property_landing_content: Replace blanket public SELECT with scoped policy
-- Only allow reading content for properties that are 'disponivel' (available)
DROP POLICY IF EXISTS "Landing page content is publicly readable" ON property_landing_content;

CREATE POLICY "Landing content readable for available properties"
ON property_landing_content FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM properties p
    WHERE p.id = property_landing_content.property_id
    AND p.status = 'disponivel'
  )
);

-- 2. Fix platform_invites: Remove the anon SELECT that exposes all active invite emails
DROP POLICY IF EXISTS "Public can read active platform invites" ON platform_invites;

-- Create a SECURITY DEFINER function to look up a specific invite by ID (for signup flow)
CREATE OR REPLACE FUNCTION public.get_platform_invite(p_invite_id uuid)
RETURNS TABLE(id uuid, status text, expires_at timestamptz, name text, invite_email text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT pi.id, pi.status, pi.expires_at, pi.name, pi.invite_email
  FROM platform_invites pi
  WHERE pi.id = p_invite_id
  AND pi.status = 'active'
  LIMIT 1;
$$;

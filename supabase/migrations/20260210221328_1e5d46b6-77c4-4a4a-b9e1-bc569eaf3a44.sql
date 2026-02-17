
-- Allow anyone (including unauthenticated) to read a pending, non-expired invite by ID
-- This is needed so the accept-invite page can display invite details before signup
CREATE POLICY "Anyone can read pending invites"
ON public.organization_invites
FOR SELECT
TO anon, authenticated
USING (status = 'pending' AND expires_at > now());

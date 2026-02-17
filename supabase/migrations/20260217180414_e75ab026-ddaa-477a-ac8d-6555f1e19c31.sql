-- Allow unauthenticated (anon) users to read pending, non-expired invites
-- so the signup form can load invite details
CREATE POLICY "Anyone can read pending invites by id"
ON public.organization_invites
FOR SELECT
TO anon
USING (
  status = 'pending'::invite_status
  AND expires_at > now()
);

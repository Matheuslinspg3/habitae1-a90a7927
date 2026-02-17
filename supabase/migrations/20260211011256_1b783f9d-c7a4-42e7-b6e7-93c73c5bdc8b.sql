-- Allow public (anon) read access to platform_invites for signup validation
CREATE POLICY "Public can read active platform invites"
ON public.platform_invites
FOR SELECT
TO anon
USING (status = 'active');
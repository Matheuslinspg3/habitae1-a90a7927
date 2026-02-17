-- Add invite_code to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Generate codes for existing organizations
UPDATE public.organizations 
SET invite_code = UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6))
WHERE invite_code IS NULL;

-- Make it NOT NULL with a default
ALTER TABLE public.organizations ALTER COLUMN invite_code SET DEFAULT UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6));
ALTER TABLE public.organizations ALTER COLUMN invite_code SET NOT NULL;

-- Allow authenticated users to read invite_code (needed for validation on accept-invite page)
-- The org name is already readable, so this is fine
CREATE POLICY "Anyone can read org invite_code" ON public.organizations
FOR SELECT USING (true);
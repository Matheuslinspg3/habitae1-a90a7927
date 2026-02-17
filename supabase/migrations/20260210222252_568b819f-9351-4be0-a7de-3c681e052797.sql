
ALTER TABLE public.organization_invites ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.organization_invites ALTER COLUMN email SET DEFAULT NULL;

-- Drop the unique constraint on email+org if exists
DROP INDEX IF EXISTS organization_invites_email_organization_id_idx;

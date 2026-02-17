
-- Add verification fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS creci_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS creci_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS creci_verified_name text,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

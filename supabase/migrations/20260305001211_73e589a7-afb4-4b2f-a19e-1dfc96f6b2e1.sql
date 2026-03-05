ALTER TABLE public.rd_station_settings
  ADD COLUMN IF NOT EXISTS oauth_access_token text,
  ADD COLUMN IF NOT EXISTS oauth_refresh_token text,
  ADD COLUMN IF NOT EXISTS oauth_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS oauth_client_id text;
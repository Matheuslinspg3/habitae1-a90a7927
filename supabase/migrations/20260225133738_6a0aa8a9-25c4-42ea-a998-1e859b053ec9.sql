
-- Add API key columns to rd_station_settings
ALTER TABLE public.rd_station_settings
  ADD COLUMN api_public_key TEXT,
  ADD COLUMN api_private_key TEXT;

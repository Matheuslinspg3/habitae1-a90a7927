
-- Create user_devices table for push notification device registration
CREATE TABLE public.user_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  onesignal_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web',
  metadata JSONB DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, onesignal_id)
);

-- Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Users can manage their own devices
CREATE POLICY "Users can view their own devices"
ON public.user_devices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices"
ON public.user_devices FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices"
ON public.user_devices FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices"
ON public.user_devices FOR DELETE
USING (auth.uid() = user_id);

-- Service role (used by edge functions) bypasses RLS, so send-push will work fine

-- Index for fast lookups by user_id
CREATE INDEX idx_user_devices_user_id ON public.user_devices(user_id);

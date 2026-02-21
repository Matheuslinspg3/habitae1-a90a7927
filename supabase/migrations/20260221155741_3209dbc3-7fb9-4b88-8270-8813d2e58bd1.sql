-- Add unique constraint for upsert support (user_id + fcm_token)
ALTER TABLE public.push_subscriptions 
  ADD CONSTRAINT push_subscriptions_user_token_unique 
  UNIQUE (user_id, fcm_token);
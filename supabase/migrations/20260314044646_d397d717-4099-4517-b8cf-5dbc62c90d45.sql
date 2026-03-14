-- Add FK for agent_id on property_visits to allow Supabase join
ALTER TABLE public.property_visits
  ADD CONSTRAINT property_visits_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;
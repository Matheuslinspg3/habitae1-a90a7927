
-- Add cross-reference columns between appointments and lead_interactions
ALTER TABLE public.appointments ADD COLUMN interaction_id uuid REFERENCES public.lead_interactions(id) ON DELETE SET NULL;
ALTER TABLE public.lead_interactions ADD COLUMN appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX idx_appointments_interaction_id ON public.appointments(interaction_id) WHERE interaction_id IS NOT NULL;
CREATE INDEX idx_lead_interactions_appointment_id ON public.lead_interactions(appointment_id) WHERE appointment_id IS NOT NULL;


-- =============================================
-- 1. NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'new_property',
  title TEXT NOT NULL,
  message TEXT,
  entity_id UUID,
  entity_type TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- =============================================
-- 2. PROPERTY LANDING OVERRIDES TABLE (for visual editor)
-- =============================================
CREATE TABLE public.property_landing_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  custom_headline TEXT,
  custom_subheadline TEXT,
  custom_description TEXT,
  custom_cta_primary TEXT,
  custom_cta_secondary TEXT,
  custom_key_features JSONB,
  hide_exact_address BOOLEAN NOT NULL DEFAULT true,
  show_nearby_pois BOOLEAN NOT NULL DEFAULT true,
  map_radius_meters INTEGER NOT NULL DEFAULT 100,
  custom_sections JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id)
);

ALTER TABLE public.property_landing_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view overrides"
  ON public.property_landing_overrides FOR SELECT
  USING (true);

CREATE POLICY "Org members can manage overrides"
  ON public.property_landing_overrides FOR ALL
  USING (public.is_member_of_org(organization_id))
  WITH CHECK (public.is_member_of_org(organization_id));

-- Trigger for updated_at
CREATE TRIGGER update_property_landing_overrides_updated_at
  BEFORE UPDATE ON public.property_landing_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 3. Function to get marketplace property with org contact
-- =============================================
CREATE OR REPLACE FUNCTION public.get_marketplace_contact(p_property_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'org_name', o.name,
    'org_phone', o.phone,
    'org_email', o.email,
    'owner_name', p.full_name,
    'owner_phone', p.phone
  ) INTO result
  FROM marketplace_properties mp
  JOIN organizations o ON o.id = mp.organization_id
  LEFT JOIN profiles p ON p.user_id = o.created_by AND p.organization_id = o.id
  WHERE mp.id = p_property_id;

  RETURN result;
END;
$$;

-- =============================================
-- 4. Function to create notifications for new marketplace properties
-- =============================================
CREATE OR REPLACE FUNCTION public.notify_new_marketplace_property()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert notification for all users NOT in the publishing organization
  INSERT INTO public.notifications (user_id, organization_id, type, title, message, entity_id, entity_type)
  SELECT 
    p.user_id,
    p.organization_id,
    'new_marketplace_property',
    'Novo imóvel no Marketplace',
    'Um novo imóvel foi publicado: ' || NEW.title,
    NEW.id,
    'marketplace_property'
  FROM public.profiles p
  WHERE p.organization_id IS NOT NULL
    AND p.organization_id != NEW.organization_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_marketplace_property
  AFTER INSERT ON public.marketplace_properties
  FOR EACH ROW
  WHEN (NEW.status = 'disponivel')
  EXECUTE FUNCTION public.notify_new_marketplace_property();

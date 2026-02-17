-- =============================================
-- FASE 1: MARKETPLACE E SISTEMA DE ASSINATURAS
-- =============================================

-- 1. CRIAR ENUMS
-- =============================================

-- Status de assinatura
CREATE TYPE subscription_status AS ENUM (
  'trial', 'active', 'cancelled', 'suspended', 'expired'
);

-- Ciclo de cobrança
CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');

-- Visibilidade de imóvel
CREATE TYPE property_visibility_type AS ENUM (
  'private',        -- Apenas a organização vê
  'partners_only',  -- Visível para parceiros aprovados
  'public'          -- Visível para todos os assinantes
);

-- Status de parceria
CREATE TYPE partnership_status AS ENUM (
  'pending', 'active', 'rejected', 'expired'
);

-- 2. CRIAR TABELAS
-- =============================================

-- Tabela de planos de assinatura
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2) NOT NULL,
  max_own_properties INTEGER,
  max_shared_properties INTEGER,
  max_leads INTEGER,
  max_users INTEGER,
  marketplace_access BOOLEAN NOT NULL DEFAULT false,
  marketplace_views_limit INTEGER,
  partnership_access BOOLEAN NOT NULL DEFAULT false,
  priority_support BOOLEAN NOT NULL DEFAULT false,
  features JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de assinaturas
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'trial',
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Tabela de imóveis do marketplace (gerenciados pela Habitae)
CREATE TABLE public.marketplace_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  property_type_id UUID REFERENCES public.property_types(id),
  transaction_type transaction_type NOT NULL DEFAULT 'venda',
  sale_price DECIMAL(15,2),
  rent_price DECIMAL(15,2),
  commission_percentage DECIMAL(5,2),
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zipcode TEXT,
  bedrooms INTEGER DEFAULT 0,
  suites INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 0,
  parking_spots INTEGER DEFAULT 0,
  area_total DECIMAL(10,2),
  area_built DECIMAL(10,2),
  amenities TEXT[],
  images TEXT[],
  owner_name TEXT,
  owner_phone TEXT,
  owner_email TEXT,
  status property_status NOT NULL DEFAULT 'disponivel',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de visibilidade de imóveis
CREATE TABLE public.property_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  visibility property_visibility_type NOT NULL DEFAULT 'private',
  show_owner_contact BOOLEAN NOT NULL DEFAULT false,
  partnership_commission DECIMAL(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id)
);

-- Tabela de parcerias de imóveis
CREATE TABLE public.property_partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  partner_organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  commission_split DECIMAL(5,2) NOT NULL,
  status partnership_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de proprietários de imóveis
CREATE TABLE public.property_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de log de acesso a contatos do marketplace
CREATE TABLE public.marketplace_contact_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  marketplace_property_id UUID NOT NULL REFERENCES public.marketplace_properties(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. CRIAR ÍNDICES
-- =============================================

CREATE INDEX idx_subscriptions_org ON public.subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON public.subscriptions(current_period_end);

CREATE INDEX idx_marketplace_properties_status ON public.marketplace_properties(status);
CREATE INDEX idx_marketplace_properties_type ON public.marketplace_properties(transaction_type);
CREATE INDEX idx_marketplace_properties_featured ON public.marketplace_properties(is_featured);
CREATE INDEX idx_marketplace_properties_city ON public.marketplace_properties(address_city);

CREATE INDEX idx_property_visibility_property ON public.property_visibility(property_id);
CREATE INDEX idx_property_visibility_type ON public.property_visibility(visibility);

CREATE INDEX idx_property_partnerships_property ON public.property_partnerships(property_id);
CREATE INDEX idx_property_partnerships_owner ON public.property_partnerships(owner_organization_id);
CREATE INDEX idx_property_partnerships_partner ON public.property_partnerships(partner_organization_id);
CREATE INDEX idx_property_partnerships_status ON public.property_partnerships(status);

CREATE INDEX idx_property_owners_property ON public.property_owners(property_id);
CREATE INDEX idx_property_owners_org ON public.property_owners(organization_id);

CREATE INDEX idx_marketplace_contact_access_user ON public.marketplace_contact_access(user_id);
CREATE INDEX idx_marketplace_contact_access_org ON public.marketplace_contact_access(organization_id);
CREATE INDEX idx_marketplace_contact_access_property ON public.marketplace_contact_access(marketplace_property_id);

-- 4. CRIAR FUNÇÕES AUXILIARES
-- =============================================

-- Verifica se organização tem assinatura ativa
CREATE OR REPLACE FUNCTION public.has_active_subscription(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE organization_id = org_id
    AND status IN ('active', 'trial')
    AND current_period_end > NOW()
  );
$$;

-- Retorna o ID do plano atual da organização
CREATE OR REPLACE FUNCTION public.get_subscription_plan_id(org_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT plan_id FROM public.subscriptions
  WHERE organization_id = org_id
  AND status IN ('active', 'trial')
  AND current_period_end > NOW()
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- Retorna o slug do plano atual da organização
CREATE OR REPLACE FUNCTION public.get_subscription_plan_slug(org_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.slug FROM public.subscriptions s
  JOIN public.subscription_plans p ON p.id = s.plan_id
  WHERE s.organization_id = org_id
  AND s.status IN ('active', 'trial')
  AND s.current_period_end > NOW()
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;

-- Verifica se pode acessar o marketplace
CREATE OR REPLACE FUNCTION public.can_access_marketplace(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    JOIN public.subscription_plans p ON p.id = s.plan_id
    WHERE s.organization_id = org_id
    AND s.status IN ('active', 'trial')
    AND s.current_period_end > NOW()
    AND p.marketplace_access = true
  );
$$;

-- Verifica se pode acessar parcerias
CREATE OR REPLACE FUNCTION public.can_access_partnerships(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    JOIN public.subscription_plans p ON p.id = s.plan_id
    WHERE s.organization_id = org_id
    AND s.status IN ('active', 'trial')
    AND s.current_period_end > NOW()
    AND p.partnership_access = true
  );
$$;

-- Função para criar assinatura trial para nova organização
CREATE OR REPLACE FUNCTION public.create_trial_subscription(org_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  starter_plan_id UUID;
  new_subscription_id UUID;
BEGIN
  -- Buscar o plano Starter
  SELECT id INTO starter_plan_id FROM public.subscription_plans WHERE slug = 'starter' LIMIT 1;
  
  IF starter_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plano Starter não encontrado';
  END IF;
  
  -- Criar assinatura trial de 14 dias
  INSERT INTO public.subscriptions (
    organization_id,
    plan_id,
    status,
    billing_cycle,
    current_period_start,
    current_period_end,
    trial_end
  ) VALUES (
    org_id,
    starter_plan_id,
    'trial',
    'monthly',
    NOW(),
    NOW() + INTERVAL '14 days',
    NOW() + INTERVAL '14 days'
  )
  RETURNING id INTO new_subscription_id;
  
  RETURN new_subscription_id;
END;
$$;

-- 5. TRIGGERS
-- =============================================

-- Trigger para atualizar updated_at
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_marketplace_properties_updated_at
  BEFORE UPDATE ON public.marketplace_properties
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_property_visibility_updated_at
  BEFORE UPDATE ON public.property_visibility
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_property_partnerships_updated_at
  BEFORE UPDATE ON public.property_partnerships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_property_owners_updated_at
  BEFORE UPDATE ON public.property_owners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. HABILITAR RLS
-- =============================================

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_contact_access ENABLE ROW LEVEL SECURITY;

-- 7. POLÍTICAS RLS
-- =============================================

-- subscription_plans: todos podem ver planos ativos
CREATE POLICY "Anyone can view active subscription plans"
  ON public.subscription_plans
  FOR SELECT
  USING (is_active = true);

-- subscriptions: organização vê sua própria assinatura
CREATE POLICY "Organizations can view their own subscription"
  ON public.subscriptions
  FOR SELECT
  USING (organization_id = get_user_organization_id());

-- marketplace_properties: apenas assinantes ativos podem ver
CREATE POLICY "Subscribers can view marketplace properties"
  ON public.marketplace_properties
  FOR SELECT
  USING (
    has_active_subscription(get_user_organization_id())
    AND can_access_marketplace(get_user_organization_id())
  );

-- property_visibility: dono do imóvel pode ver e editar
CREATE POLICY "Property owners can view visibility settings"
  ON public.property_visibility
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_visibility.property_id
      AND is_member_of_org(p.organization_id)
    )
  );

CREATE POLICY "Property owners can insert visibility settings"
  ON public.property_visibility
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_visibility.property_id
      AND is_member_of_org(p.organization_id)
    )
  );

CREATE POLICY "Property owners can update visibility settings"
  ON public.property_visibility
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_visibility.property_id
      AND is_member_of_org(p.organization_id)
    )
  );

-- property_partnerships: dono ou parceiro podem ver
CREATE POLICY "Partnership participants can view partnerships"
  ON public.property_partnerships
  FOR SELECT
  USING (
    owner_organization_id = get_user_organization_id()
    OR partner_organization_id = get_user_organization_id()
    OR (partner_organization_id IS NULL AND can_access_partnerships(get_user_organization_id()))
  );

CREATE POLICY "Property owners can create partnerships"
  ON public.property_partnerships
  FOR INSERT
  WITH CHECK (owner_organization_id = get_user_organization_id());

CREATE POLICY "Partnership participants can update partnerships"
  ON public.property_partnerships
  FOR UPDATE
  USING (
    owner_organization_id = get_user_organization_id()
    OR partner_organization_id = get_user_organization_id()
  );

CREATE POLICY "Property owners can delete partnerships"
  ON public.property_partnerships
  FOR DELETE
  USING (owner_organization_id = get_user_organization_id());

-- property_owners: dono do imóvel pode gerenciar
CREATE POLICY "Organization members can view their property owners"
  ON public.property_owners
  FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Organization members can create property owners"
  ON public.property_owners
  FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Organization members can update their property owners"
  ON public.property_owners
  FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Organization members can delete their property owners"
  ON public.property_owners
  FOR DELETE
  USING (organization_id = get_user_organization_id());

-- marketplace_contact_access: organização vê seus próprios acessos
CREATE POLICY "Organizations can view their contact access logs"
  ON public.marketplace_contact_access
  FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Organizations can log contact access"
  ON public.marketplace_contact_access
  FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND has_active_subscription(organization_id)
  );

-- 8. INSERIR PLANOS DE ASSINATURA
-- =============================================

INSERT INTO public.subscription_plans (name, slug, description, price_monthly, price_yearly, max_own_properties, max_shared_properties, max_leads, max_users, marketplace_access, marketplace_views_limit, partnership_access, priority_support, features, display_order) VALUES
(
  'Starter',
  'starter',
  'Ideal para corretores iniciantes',
  79.00,
  790.00,
  10,
  5,
  100,
  1,
  true,
  50,
  false,
  false,
  '{"reports": "basic", "support": "email"}',
  1
),
(
  'Profissional',
  'pro',
  'Para corretores que querem crescer',
  149.00,
  1490.00,
  50,
  25,
  500,
  5,
  true,
  NULL,
  true,
  false,
  '{"reports": "advanced", "support": "email_chat"}',
  2
),
(
  'Enterprise',
  'enterprise',
  'Para imobiliárias e equipes',
  299.00,
  2990.00,
  NULL,
  NULL,
  NULL,
  NULL,
  true,
  NULL,
  true,
  true,
  '{"reports": "custom", "support": "priority", "featured_listings": true}',
  3
);
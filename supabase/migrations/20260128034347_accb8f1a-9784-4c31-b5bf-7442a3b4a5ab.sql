-- =====================================================
-- IMOBGEST ERP-CRM: ESTRUTURA COMPLETA DO BANCO DE DADOS
-- Multi-tenant com isolamento total por organização
-- =====================================================

-- 1. ENUMS
-- =====================================================

-- Tipo de organização
CREATE TYPE public.organization_type AS ENUM ('imobiliaria', 'corretor_individual');

-- Roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'corretor', 'assistente');

-- Status de propriedade
CREATE TYPE public.property_status AS ENUM ('disponivel', 'reservado', 'vendido', 'alugado', 'inativo');

-- Tipo de transação de imóvel
CREATE TYPE public.transaction_type AS ENUM ('venda', 'aluguel', 'ambos');

-- Status de lead
CREATE TYPE public.lead_stage AS ENUM ('novo', 'contato', 'visita', 'proposta', 'negociacao', 'fechado_ganho', 'fechado_perdido');

-- Status de contrato
CREATE TYPE public.contract_status AS ENUM ('rascunho', 'ativo', 'encerrado', 'cancelado');

-- Tipo de contrato
CREATE TYPE public.contract_type AS ENUM ('venda', 'locacao');

-- Tipo de transação financeira
CREATE TYPE public.financial_transaction_type AS ENUM ('receita', 'despesa');

-- Status de cobrança
CREATE TYPE public.invoice_status AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');

-- Status de convite
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

-- Tipo de interação
CREATE TYPE public.interaction_type AS ENUM ('ligacao', 'email', 'visita', 'whatsapp', 'reuniao', 'nota');

-- 2. TABELAS BASE
-- =====================================================

-- Organizações (imobiliárias ou corretores individuais)
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type organization_type NOT NULL DEFAULT 'corretor_individual',
    cnpj TEXT,
    phone TEXT,
    email TEXT,
    address_street TEXT,
    address_number TEXT,
    address_complement TEXT,
    address_neighborhood TEXT,
    address_city TEXT,
    address_state TEXT,
    address_zipcode TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Perfis de usuários
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    creci TEXT,
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles de usuários (tabela separada por segurança)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'corretor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, organization_id)
);

-- Convites de organização
CREATE TABLE public.organization_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role app_role NOT NULL DEFAULT 'corretor',
    status invite_status NOT NULL DEFAULT 'pending',
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, email)
);

-- 3. TABELAS DE IMÓVEIS
-- =====================================================

-- Tipos de imóveis (padrão + personalizados)
CREATE TABLE public.property_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Imóveis
CREATE TABLE public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    property_type_id UUID REFERENCES public.property_types(id),
    title TEXT NOT NULL,
    description TEXT,
    transaction_type transaction_type NOT NULL DEFAULT 'venda',
    sale_price DECIMAL(15,2),
    rent_price DECIMAL(15,2),
    condominium_fee DECIMAL(15,2),
    iptu DECIMAL(15,2),
    status property_status NOT NULL DEFAULT 'disponivel',
    bedrooms INTEGER DEFAULT 0,
    suites INTEGER DEFAULT 0,
    bathrooms INTEGER DEFAULT 0,
    parking_spots INTEGER DEFAULT 0,
    area_total DECIMAL(10,2),
    area_built DECIMAL(10,2),
    floor INTEGER,
    address_street TEXT,
    address_number TEXT,
    address_complement TEXT,
    address_neighborhood TEXT,
    address_city TEXT,
    address_state TEXT,
    address_zipcode TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    amenities TEXT[],
    featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Imagens de imóveis
CREATE TABLE public.property_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    is_cover BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TABELAS DE CRM
-- =====================================================

-- Tipos de leads (personalizáveis)
CREATE TABLE public.lead_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leads
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    lead_type_id UUID REFERENCES public.lead_types(id),
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    broker_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    stage lead_stage NOT NULL DEFAULT 'novo',
    estimated_value DECIMAL(15,2),
    source TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Interações com leads
CREATE TABLE public.lead_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    type interaction_type NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TABELAS DE CONTRATOS
-- =====================================================

-- Contratos
CREATE TABLE public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    broker_id UUID REFERENCES auth.users(id),
    code TEXT NOT NULL,
    type contract_type NOT NULL,
    status contract_status NOT NULL DEFAULT 'rascunho',
    value DECIMAL(15,2) NOT NULL,
    commission_percentage DECIMAL(5,2),
    start_date DATE,
    end_date DATE,
    payment_day INTEGER,
    readjustment_index TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documentos de contratos
CREATE TABLE public.contract_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. TABELAS FINANCEIRAS
-- =====================================================

-- Categorias de transações
CREATE TABLE public.transaction_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type financial_transaction_type NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transações financeiras
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    category_id UUID REFERENCES public.transaction_categories(id),
    contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
    type financial_transaction_type NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    date DATE NOT NULL,
    paid BOOLEAN DEFAULT false,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cobranças
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    due_date DATE NOT NULL,
    status invoice_status NOT NULL DEFAULT 'pendente',
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comissões
CREATE TABLE public.commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    broker_id UUID NOT NULL REFERENCES auth.users(id),
    amount DECIMAL(15,2) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    paid BOOLEAN DEFAULT false,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. TABELAS DE AGENDA
-- =====================================================

-- Compromissos
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location TEXT,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tarefas
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    priority TEXT DEFAULT 'media',
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. CÓDIGOS DE VERIFICAÇÃO
-- =====================================================

CREATE TABLE public.verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    code TEXT NOT NULL,
    type TEXT NOT NULL, -- 'email', 'phone', '2fa'
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. FUNÇÕES AUXILIARES (SECURITY DEFINER)
-- =====================================================

-- Obter organization_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organization_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
    LIMIT 1
$$;

-- Verificar se usuário tem determinado role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Verificar se usuário é admin da organização
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.profiles p ON p.user_id = ur.user_id
        WHERE ur.user_id = _user_id
          AND ur.role = 'admin'
          AND ur.organization_id = p.organization_id
    )
$$;

-- Verificar se usuário é membro de uma organização específica
CREATE OR REPLACE FUNCTION public.is_member_of_org(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = auth.uid()
          AND organization_id = _org_id
    )
$$;

-- Obter role do usuário na organização
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ur.role
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id AND p.organization_id = ur.organization_id
    WHERE ur.user_id = auth.uid()
    LIMIT 1
$$;

-- 10. TRIGGERS PARA UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. HABILITAR RLS EM TODAS AS TABELAS
-- =====================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- 12. POLÍTICAS RLS
-- =====================================================

-- Organizations
CREATE POLICY "Users can view their own organization"
ON public.organizations FOR SELECT
USING (public.is_member_of_org(id));

CREATE POLICY "Admins can update their organization"
ON public.organizations FOR UPDATE
USING (public.is_member_of_org(id) AND public.is_org_admin(auth.uid()));

CREATE POLICY "Users can create organizations during signup"
ON public.organizations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Profiles
CREATE POLICY "Users can view profiles in their organization"
ON public.profiles FOR SELECT
USING (organization_id = public.get_user_organization_id() OR user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT
WITH CHECK (user_id = auth.uid());

-- User Roles
CREATE POLICY "Users can view roles in their organization"
ON public.user_roles FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can manage roles in their organization"
ON public.user_roles FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id() AND public.is_org_admin(auth.uid()));

CREATE POLICY "Admins can delete roles in their organization"
ON public.user_roles FOR DELETE
USING (organization_id = public.get_user_organization_id() AND public.is_org_admin(auth.uid()));

-- Organization Invites
CREATE POLICY "Admins can view invites for their organization"
ON public.organization_invites FOR SELECT
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can create invites"
ON public.organization_invites FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id() AND public.is_org_admin(auth.uid()));

CREATE POLICY "Admins can update invites"
ON public.organization_invites FOR UPDATE
USING (organization_id = public.get_user_organization_id() AND public.is_org_admin(auth.uid()));

CREATE POLICY "Admins can delete invites"
ON public.organization_invites FOR DELETE
USING (organization_id = public.get_user_organization_id() AND public.is_org_admin(auth.uid()));

-- Property Types (include defaults visible to all)
CREATE POLICY "Users can view property types"
ON public.property_types FOR SELECT
USING (organization_id = public.get_user_organization_id() OR is_default = true);

CREATE POLICY "Users can create property types for their org"
ON public.property_types FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update their org property types"
ON public.property_types FOR UPDATE
USING (organization_id = public.get_user_organization_id() AND is_default = false);

CREATE POLICY "Users can delete their org property types"
ON public.property_types FOR DELETE
USING (organization_id = public.get_user_organization_id() AND is_default = false);

-- Properties
CREATE POLICY "Users can view properties in their organization"
ON public.properties FOR SELECT
USING (public.is_member_of_org(organization_id));

CREATE POLICY "Users can create properties"
ON public.properties FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update properties in their organization"
ON public.properties FOR UPDATE
USING (public.is_member_of_org(organization_id));

CREATE POLICY "Admins can delete properties"
ON public.properties FOR DELETE
USING (public.is_member_of_org(organization_id) AND public.is_org_admin(auth.uid()));

-- Property Images
CREATE POLICY "Users can view property images"
ON public.property_images FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.properties p 
    WHERE p.id = property_id 
    AND public.is_member_of_org(p.organization_id)
));

CREATE POLICY "Users can create property images"
ON public.property_images FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.properties p 
    WHERE p.id = property_id 
    AND public.is_member_of_org(p.organization_id)
));

CREATE POLICY "Users can delete property images"
ON public.property_images FOR DELETE
USING (EXISTS (
    SELECT 1 FROM public.properties p 
    WHERE p.id = property_id 
    AND public.is_member_of_org(p.organization_id)
));

-- Lead Types
CREATE POLICY "Users can view lead types"
ON public.lead_types FOR SELECT
USING (organization_id = public.get_user_organization_id() OR is_default = true);

CREATE POLICY "Users can create lead types"
ON public.lead_types FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update their org lead types"
ON public.lead_types FOR UPDATE
USING (organization_id = public.get_user_organization_id() AND is_default = false);

CREATE POLICY "Users can delete their org lead types"
ON public.lead_types FOR DELETE
USING (organization_id = public.get_user_organization_id() AND is_default = false);

-- Leads
CREATE POLICY "Users can view leads in their organization"
ON public.leads FOR SELECT
USING (public.is_member_of_org(organization_id));

CREATE POLICY "Users can create leads"
ON public.leads FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update leads in their organization"
ON public.leads FOR UPDATE
USING (public.is_member_of_org(organization_id));

CREATE POLICY "Admins can delete leads"
ON public.leads FOR DELETE
USING (public.is_member_of_org(organization_id) AND public.is_org_admin(auth.uid()));

-- Lead Interactions
CREATE POLICY "Users can view lead interactions"
ON public.lead_interactions FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.leads l 
    WHERE l.id = lead_id 
    AND public.is_member_of_org(l.organization_id)
));

CREATE POLICY "Users can create lead interactions"
ON public.lead_interactions FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.leads l 
    WHERE l.id = lead_id 
    AND public.is_member_of_org(l.organization_id)
));

-- Contracts
CREATE POLICY "Users can view contracts in their organization"
ON public.contracts FOR SELECT
USING (public.is_member_of_org(organization_id));

CREATE POLICY "Users can create contracts"
ON public.contracts FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update contracts in their organization"
ON public.contracts FOR UPDATE
USING (public.is_member_of_org(organization_id));

CREATE POLICY "Admins can delete contracts"
ON public.contracts FOR DELETE
USING (public.is_member_of_org(organization_id) AND public.is_org_admin(auth.uid()));

-- Contract Documents
CREATE POLICY "Users can view contract documents"
ON public.contract_documents FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.contracts c 
    WHERE c.id = contract_id 
    AND public.is_member_of_org(c.organization_id)
));

CREATE POLICY "Users can create contract documents"
ON public.contract_documents FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.contracts c 
    WHERE c.id = contract_id 
    AND public.is_member_of_org(c.organization_id)
));

-- Transaction Categories
CREATE POLICY "Users can view transaction categories"
ON public.transaction_categories FOR SELECT
USING (organization_id = public.get_user_organization_id() OR is_default = true);

CREATE POLICY "Users can create transaction categories"
ON public.transaction_categories FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

-- Transactions
CREATE POLICY "Users can view transactions in their organization"
ON public.transactions FOR SELECT
USING (public.is_member_of_org(organization_id));

CREATE POLICY "Users can create transactions"
ON public.transactions FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update transactions in their organization"
ON public.transactions FOR UPDATE
USING (public.is_member_of_org(organization_id));

CREATE POLICY "Admins can delete transactions"
ON public.transactions FOR DELETE
USING (public.is_member_of_org(organization_id) AND public.is_org_admin(auth.uid()));

-- Invoices
CREATE POLICY "Users can view invoices in their organization"
ON public.invoices FOR SELECT
USING (public.is_member_of_org(organization_id));

CREATE POLICY "Users can create invoices"
ON public.invoices FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update invoices in their organization"
ON public.invoices FOR UPDATE
USING (public.is_member_of_org(organization_id));

-- Commissions
CREATE POLICY "Users can view commissions in their organization"
ON public.commissions FOR SELECT
USING (public.is_member_of_org(organization_id));

CREATE POLICY "Users can create commissions"
ON public.commissions FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

-- Appointments
CREATE POLICY "Users can view appointments in their organization"
ON public.appointments FOR SELECT
USING (public.is_member_of_org(organization_id));

CREATE POLICY "Users can create appointments"
ON public.appointments FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update appointments in their organization"
ON public.appointments FOR UPDATE
USING (public.is_member_of_org(organization_id));

CREATE POLICY "Users can delete appointments"
ON public.appointments FOR DELETE
USING (public.is_member_of_org(organization_id));

-- Tasks
CREATE POLICY "Users can view tasks in their organization"
ON public.tasks FOR SELECT
USING (public.is_member_of_org(organization_id));

CREATE POLICY "Users can create tasks"
ON public.tasks FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update tasks in their organization"
ON public.tasks FOR UPDATE
USING (public.is_member_of_org(organization_id));

CREATE POLICY "Users can delete tasks"
ON public.tasks FOR DELETE
USING (public.is_member_of_org(organization_id));

-- Verification Codes
CREATE POLICY "Users can view their own verification codes"
ON public.verification_codes FOR SELECT
USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Anyone can create verification codes"
ON public.verification_codes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own verification codes"
ON public.verification_codes FOR UPDATE
USING (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- 13. INSERIR DADOS PADRÃO
-- =====================================================

-- Tipos de imóveis padrão
INSERT INTO public.property_types (name, is_default) VALUES
    ('Casa', true),
    ('Apartamento', true),
    ('Terreno', true),
    ('Sala Comercial', true),
    ('Loja', true),
    ('Galpão', true),
    ('Cobertura', true),
    ('Sítio/Chácara', true),
    ('Studio/Kitnet', true),
    ('Sobrado', true),
    ('Flat', true),
    ('Fazenda', true);

-- Tipos de leads padrão
INSERT INTO public.lead_types (name, color, is_default) VALUES
    ('Comprador', '#22c55e', true),
    ('Locatário', '#3b82f6', true),
    ('Investidor', '#f59e0b', true),
    ('Proprietário', '#8b5cf6', true);

-- Categorias financeiras padrão
INSERT INTO public.transaction_categories (name, type, is_default) VALUES
    ('Comissão de Venda', 'receita', true),
    ('Comissão de Locação', 'receita', true),
    ('Taxa de Administração', 'receita', true),
    ('Aluguel Recebido', 'receita', true),
    ('Outras Receitas', 'receita', true),
    ('Salários', 'despesa', true),
    ('Aluguel do Escritório', 'despesa', true),
    ('Marketing', 'despesa', true),
    ('Infraestrutura', 'despesa', true),
    ('Impostos', 'despesa', true),
    ('Outras Despesas', 'despesa', true);

-- 14. ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_organization_id ON public.user_roles(organization_id);
CREATE INDEX idx_properties_organization_id ON public.properties(organization_id);
CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_leads_organization_id ON public.leads(organization_id);
CREATE INDEX idx_leads_stage ON public.leads(stage);
CREATE INDEX idx_contracts_organization_id ON public.contracts(organization_id);
CREATE INDEX idx_transactions_organization_id ON public.transactions(organization_id);
CREATE INDEX idx_appointments_organization_id ON public.appointments(organization_id);
CREATE INDEX idx_tasks_organization_id ON public.tasks(organization_id);
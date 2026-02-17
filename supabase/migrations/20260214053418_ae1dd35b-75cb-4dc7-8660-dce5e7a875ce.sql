
-- ============================================
-- Extend subscriptions table for multi-provider (Asaas)
-- ============================================
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'asaas',
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

-- Rename stripe columns if they exist (keep data)
DO $$ BEGIN
  ALTER TABLE public.subscriptions RENAME COLUMN stripe_subscription_id TO legacy_stripe_subscription_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.subscriptions RENAME COLUMN stripe_customer_id TO legacy_stripe_customer_id;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- Add 'overdue' to subscription_status if not exists
DO $$ BEGIN
  ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'overdue';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- TABLE: billing_payments
-- ============================================
CREATE TABLE IF NOT EXISTS public.billing_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'asaas',
  provider_payment_id TEXT,
  amount_cents INTEGER NOT NULL,
  method TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  invoice_url TEXT,
  pix_qr_code TEXT,
  pix_copy_paste TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Org members can view their payments"
    ON public.billing_payments FOR SELECT
    USING (is_member_of_org(organization_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Org members can insert payments"
    ON public.billing_payments FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Org admins can update payments"
    ON public.billing_payments FOR UPDATE
    USING (is_member_of_org(organization_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_billing_payments_org ON public.billing_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_sub ON public.billing_payments(subscription_id);

-- ============================================
-- TABLE: billing_webhook_logs
-- ============================================
CREATE TABLE IF NOT EXISTS public.billing_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'asaas',
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_webhook_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "System admins can view webhook logs"
    ON public.billing_webhook_logs FOR SELECT
    USING (is_system_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can insert webhook logs"
    ON public.billing_webhook_logs FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- FUNCTION: Check if org has active subscription
-- ============================================
CREATE OR REPLACE FUNCTION public.org_has_active_subscription(p_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE organization_id = p_organization_id
      AND (
        status = 'active'
        OR (status = 'trial' AND (trial_end IS NULL OR trial_end > now()))
      )
  )
$$;


-- AI Token Billing: Usage Events table
CREATE TABLE public.ai_token_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  request_id text NOT NULL DEFAULT gen_random_uuid()::text,
  provider text NOT NULL,
  model text NOT NULL,
  function_name text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  estimated_provider_cost numeric(12,8) NOT NULL DEFAULT 0,
  markup_percentage numeric(6,2) NOT NULL DEFAULT 30.00,
  simulated_bill_amount numeric(12,8) GENERATED ALWAYS AS (estimated_provider_cost * (1 + markup_percentage / 100)) STORED,
  currency text NOT NULL DEFAULT 'USD',
  request_status text NOT NULL DEFAULT 'success',
  error_message text,
  stripe_meter_event_id text,
  stripe_sync_status text DEFAULT 'pending',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- AI Token Billing: Pricing Config table  
CREATE TABLE public.ai_billing_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model text NOT NULL,
  price_per_1k_input_tokens numeric(12,8) NOT NULL DEFAULT 0,
  price_per_1k_output_tokens numeric(12,8) NOT NULL DEFAULT 0,
  markup_percentage numeric(6,2) NOT NULL DEFAULT 30.00,
  fixed_margin numeric(12,8) DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(provider, model)
);

-- AI Token Billing: Simulated Invoices
CREATE TABLE public.ai_billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  total_tokens integer NOT NULL DEFAULT 0,
  total_requests integer NOT NULL DEFAULT 0,
  total_provider_cost numeric(12,8) NOT NULL DEFAULT 0,
  total_billed_amount numeric(12,8) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  stripe_invoice_id text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- AI Token Billing: Feature Flag & Config
CREATE TABLE public.ai_billing_config (
  id text PRIMARY KEY DEFAULT 'default',
  billing_enabled boolean NOT NULL DEFAULT false,
  sandbox_mode boolean NOT NULL DEFAULT true,
  default_markup_percentage numeric(6,2) NOT NULL DEFAULT 30.00,
  default_currency text NOT NULL DEFAULT 'USD',
  stripe_test_mode boolean NOT NULL DEFAULT true,
  stripe_webhook_secret text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Insert default config
INSERT INTO public.ai_billing_config (id, billing_enabled, sandbox_mode, stripe_test_mode)
VALUES ('default', false, true, true);

-- Seed default pricing for common models
INSERT INTO public.ai_billing_pricing (provider, model, price_per_1k_input_tokens, price_per_1k_output_tokens, markup_percentage) VALUES
  ('openai', 'gpt-4o', 0.0025, 0.01, 30),
  ('openai', 'gpt-4o-mini', 0.00015, 0.0006, 30),
  ('openai', 'gpt-5', 0.005, 0.015, 30),
  ('openai', 'gpt-5-mini', 0.001, 0.004, 30),
  ('google', 'gemini-2.5-flash', 0.00015, 0.0006, 30),
  ('google', 'gemini-2.5-pro', 0.00125, 0.005, 30),
  ('anthropic', 'claude-3.5-sonnet', 0.003, 0.015, 30),
  ('groq', 'llama-3-70b', 0.00059, 0.00079, 30),
  ('openai', 'dall-e-3', 0.04, 0, 30),
  ('stability', 'stable-diffusion-xl', 0.002, 0, 30),
  ('leonardo', 'leonardo-diffusion-xl', 0.005, 0, 30)
ON CONFLICT (provider, model) DO NOTHING;

-- Enable RLS
ALTER TABLE public.ai_token_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_billing_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_billing_config ENABLE ROW LEVEL SECURITY;

-- RLS: Usage events - developers can see all, users see own
CREATE POLICY "Developers can view all usage events"
  ON public.ai_token_usage_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Users can view own usage events"
  ON public.ai_token_usage_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can insert own usage events"
  ON public.ai_token_usage_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS: Pricing - developers full access, authenticated read
CREATE POLICY "Anyone can read active pricing"
  ON public.ai_billing_pricing FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Developers can manage pricing"
  ON public.ai_billing_pricing FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_role(auth.uid(), 'developer'));

-- RLS: Invoices - developers see all, users see own
CREATE POLICY "Developers can view all invoices"
  ON public.ai_billing_invoices FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Users can view own invoices"
  ON public.ai_billing_invoices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Developers can manage invoices"
  ON public.ai_billing_invoices FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_role(auth.uid(), 'developer'));

-- RLS: Config - developers only
CREATE POLICY "Developers can read billing config"
  ON public.ai_billing_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can manage billing config"
  ON public.ai_billing_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'developer'))
  WITH CHECK (public.has_role(auth.uid(), 'developer'));

-- Index for performance
CREATE INDEX idx_ai_token_usage_user ON public.ai_token_usage_events(user_id, created_at DESC);
CREATE INDEX idx_ai_token_usage_provider ON public.ai_token_usage_events(provider, model, created_at DESC);
CREATE INDEX idx_ai_token_usage_org ON public.ai_token_usage_events(organization_id, created_at DESC);
CREATE INDEX idx_ai_billing_invoices_user ON public.ai_billing_invoices(user_id, period_start DESC);

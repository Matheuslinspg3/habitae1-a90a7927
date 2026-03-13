
-- Tabela de logs de uso de IA
CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  model text,
  function_name text NOT NULL,
  usage_type text NOT NULL DEFAULT 'text',
  tokens_input integer DEFAULT 0,
  tokens_output integer DEFAULT 0,
  estimated_cost_usd numeric(10,6) DEFAULT 0,
  success boolean DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Apenas developers/admins podem ver
CREATE POLICY "Developers can view ai_usage_logs"
  ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (public.is_system_admin());

-- Service role pode inserir (edge functions)
CREATE POLICY "Service role can insert ai_usage_logs"
  ON public.ai_usage_logs FOR INSERT
  WITH CHECK (true);

-- Index para queries de dashboard
CREATE INDEX idx_ai_usage_logs_created ON public.ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_usage_logs_provider ON public.ai_usage_logs(provider, created_at DESC);

-- Remover colunas de chaves da ai_provider_config (movidas para secrets)
ALTER TABLE public.ai_provider_config
  DROP COLUMN IF EXISTS text_openai_key,
  DROP COLUMN IF EXISTS text_gemini_key,
  DROP COLUMN IF EXISTS text_anthropic_key,
  DROP COLUMN IF EXISTS text_groq_key,
  DROP COLUMN IF EXISTS text_custom_key,
  DROP COLUMN IF EXISTS text_custom_url,
  DROP COLUMN IF EXISTS text_custom_model,
  DROP COLUMN IF EXISTS text_ollama_url,
  DROP COLUMN IF EXISTS text_ollama_model,
  DROP COLUMN IF EXISTS image_openai_key,
  DROP COLUMN IF EXISTS image_stability_key,
  DROP COLUMN IF EXISTS image_leonardo_key,
  DROP COLUMN IF EXISTS image_flux_key,
  DROP COLUMN IF EXISTS image_custom_key,
  DROP COLUMN IF EXISTS image_custom_url,
  DROP COLUMN IF EXISTS image_sd_url;


CREATE TABLE public.ai_provider_config (
  id text PRIMARY KEY DEFAULT 'singleton',
  text_provider text NOT NULL DEFAULT 'lovable',
  text_ollama_url text DEFAULT 'http://localhost:11434',
  text_ollama_model text DEFAULT 'llama3',
  text_openai_key text,
  text_openai_model text DEFAULT 'gpt-4o-mini',
  text_custom_url text,
  text_custom_key text,
  text_custom_model text,
  image_provider text NOT NULL DEFAULT 'lovable',
  image_sd_url text,
  image_openai_key text,
  image_custom_url text,
  image_custom_key text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.ai_provider_config ENABLE ROW LEVEL SECURITY;

-- Only system admins can read/write
CREATE POLICY "System admins can manage AI config"
  ON public.ai_provider_config
  FOR ALL
  TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

-- Insert default row
INSERT INTO public.ai_provider_config (id) VALUES ('singleton') ON CONFLICT DO NOTHING;

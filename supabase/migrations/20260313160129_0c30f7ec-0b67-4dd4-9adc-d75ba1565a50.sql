
ALTER TABLE public.ai_provider_config
  ADD COLUMN IF NOT EXISTS text_gemini_key text,
  ADD COLUMN IF NOT EXISTS text_anthropic_key text,
  ADD COLUMN IF NOT EXISTS text_groq_key text,
  ADD COLUMN IF NOT EXISTS image_stability_key text,
  ADD COLUMN IF NOT EXISTS image_leonardo_key text,
  ADD COLUMN IF NOT EXISTS image_flux_key text;

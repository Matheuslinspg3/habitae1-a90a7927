-- Tabela para armazenar tokens de importação únicos
CREATE TABLE public.import_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  source_property_ids TEXT[] NOT NULL,
  used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_import_tokens_org_id ON public.import_tokens(organization_id);
CREATE INDEX idx_import_tokens_expires_at ON public.import_tokens(expires_at) WHERE used = false;

-- Enable RLS
ALTER TABLE public.import_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create tokens for their organization"
ON public.import_tokens FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can view their organization tokens"
ON public.import_tokens FOR SELECT
USING (organization_id = get_user_organization_id());

-- Função para consumir token atomicamente (usada pela Edge Function com service role)
CREATE OR REPLACE FUNCTION public.consume_import_token(
  p_token UUID,
  p_source_property_id TEXT,
  p_org_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_record RECORD;
BEGIN
  -- Buscar e bloquear o token para update atômico
  SELECT * INTO v_token_record
  FROM public.import_tokens
  WHERE id = p_token
  FOR UPDATE;
  
  -- Token não existe
  IF v_token_record IS NULL THEN
    RETURN false;
  END IF;
  
  -- Token já foi usado
  IF v_token_record.used = true THEN
    RETURN false;
  END IF;
  
  -- Token expirou
  IF v_token_record.expires_at < now() THEN
    RETURN false;
  END IF;
  
  -- Token não pertence à organização
  IF v_token_record.organization_id != p_org_id THEN
    RETURN false;
  END IF;
  
  -- Property ID não está autorizado neste token
  IF NOT (p_source_property_id = ANY(v_token_record.source_property_ids)) THEN
    RETURN false;
  END IF;
  
  -- Tudo válido - marcar como usado
  UPDATE public.import_tokens
  SET used = true, used_at = now()
  WHERE id = p_token;
  
  RETURN true;
END;
$$;

-- Função para limpar tokens expirados (pode ser chamada periodicamente)
CREATE OR REPLACE FUNCTION public.cleanup_expired_import_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.import_tokens
  WHERE expires_at < now() - interval '1 day'
  RETURNING 1 INTO v_deleted;
  
  RETURN COALESCE(v_deleted, 0);
END;
$$;
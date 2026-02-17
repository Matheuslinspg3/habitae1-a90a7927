-- Tabela para rastrear mídias de imóveis deletados (aguardando limpeza)
CREATE TABLE public.deleted_property_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_property_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  cloudinary_public_id TEXT,
  cloudinary_url TEXT NOT NULL,
  storage_path TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cleaned_at TIMESTAMP WITH TIME ZONE,
  cleanup_error TEXT
);

-- Índice para busca de itens pendentes de limpeza
CREATE INDEX idx_deleted_media_pending ON public.deleted_property_media (deleted_at) 
WHERE cleaned_at IS NULL;

-- Índice por organização
CREATE INDEX idx_deleted_media_org ON public.deleted_property_media (organization_id);

-- RLS
ALTER TABLE public.deleted_property_media ENABLE ROW LEVEL SECURITY;

-- Apenas admins do sistema podem ver (para auditoria)
CREATE POLICY "System admins can view deleted media"
ON public.deleted_property_media
FOR SELECT
USING (public.is_system_admin());

-- Service role pode gerenciar (para o cron job)
CREATE POLICY "Service role can manage deleted media"
ON public.deleted_property_media
FOR ALL
USING (true)
WITH CHECK (true);

-- Função para capturar mídias antes da exclusão do imóvel
CREATE OR REPLACE FUNCTION public.capture_media_before_property_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Capturar mídias do property_media (Cloudinary)
  INSERT INTO public.deleted_property_media (
    original_property_id,
    organization_id,
    cloudinary_url,
    storage_path,
    cloudinary_public_id
  )
  SELECT 
    OLD.id,
    OLD.organization_id,
    pm.stored_url,
    pm.storage_path,
    -- Extrair public_id do URL do Cloudinary
    CASE 
      WHEN pm.stored_url LIKE '%cloudinary.com%' THEN
        regexp_replace(
          regexp_replace(pm.stored_url, '^.*/upload/[^/]+/', ''),
          '\.[^.]+$', ''
        )
      ELSE NULL
    END
  FROM public.property_media pm
  WHERE pm.property_id = OLD.id
    AND pm.stored_url IS NOT NULL;
  
  RETURN OLD;
END;
$$;

-- Trigger BEFORE DELETE para capturar mídias
CREATE TRIGGER trigger_capture_media_before_delete
BEFORE DELETE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.capture_media_before_property_delete();
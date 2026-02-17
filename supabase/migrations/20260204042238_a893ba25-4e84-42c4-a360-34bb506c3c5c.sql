-- Corrigir política RLS permissiva - usar auth.role() para service_role
DROP POLICY IF EXISTS "Service role can manage deleted media" ON public.deleted_property_media;

-- Política para INSERT via trigger (SECURITY DEFINER já lida com isso)
-- Não precisa de política pública, o trigger roda como SECURITY DEFINER

-- Política para o cron job (service_role bypassa RLS automaticamente)
-- Remover política "always true" - service_role já tem acesso total
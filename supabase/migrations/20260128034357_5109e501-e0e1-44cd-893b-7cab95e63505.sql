-- Corrigir política RLS muito permissiva para verification_codes
-- A política anterior permitia qualquer pessoa inserir códigos

DROP POLICY IF EXISTS "Anyone can create verification codes" ON public.verification_codes;

-- Criar política mais restritiva - apenas para usuários autenticados ou durante signup
CREATE POLICY "Users can create verification codes"
ON public.verification_codes FOR INSERT
WITH CHECK (
    -- Permitir para usuários autenticados criarem seus próprios códigos
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR 
    -- Ou para códigos vinculados a email durante signup (user_id pode ser null)
    (user_id IS NULL AND email IS NOT NULL)
);
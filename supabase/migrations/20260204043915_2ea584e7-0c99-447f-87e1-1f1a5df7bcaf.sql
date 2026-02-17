-- Adicionar campo payment_options à tabela properties
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS payment_options text[] DEFAULT '{}'::text[];
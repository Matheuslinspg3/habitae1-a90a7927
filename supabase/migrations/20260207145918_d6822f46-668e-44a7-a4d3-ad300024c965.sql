
-- =============================================
-- MIGRATION 1: Limpeza de dados + perfil + enum
-- =============================================

-- Mover imagens do property_media para deleted_property_media
INSERT INTO deleted_property_media (cloudinary_url, cloudinary_public_id, original_property_id, organization_id, storage_path)
SELECT 
  COALESCE(stored_url, original_url),
  NULL,
  property_id,
  organization_id,
  storage_path
FROM property_media
WHERE stored_url IS NOT NULL OR original_url IS NOT NULL;

-- Mover imagens do property_images para deleted_property_media
INSERT INTO deleted_property_media (cloudinary_url, original_property_id, organization_id)
SELECT 
  pi.url,
  pi.property_id,
  p.organization_id
FROM property_images pi
JOIN properties p ON p.id = pi.property_id;

-- Limpar dependências na ordem correta
DELETE FROM marketplace_properties;
DELETE FROM property_landing_content;
DELETE FROM property_partnerships;
DELETE FROM property_visibility;
DELETE FROM property_owners;
DELETE FROM property_media;
DELETE FROM property_images;

-- Anular referências em tabelas de negócio
UPDATE leads SET property_id = NULL WHERE property_id IS NOT NULL;
UPDATE contracts SET property_id = NULL WHERE property_id IS NOT NULL;
UPDATE appointments SET property_id = NULL WHERE property_id IS NOT NULL;
DELETE FROM import_run_items;
DELETE FROM import_runs;

-- Remover todos os imóveis
DELETE FROM properties;

-- Corrigir perfil do admin
UPDATE profiles 
SET onboarding_completed = true, email_verified = true
WHERE user_id = '33c17066-efae-4dc6-94f7-42c9d7235386';

-- Adicionar novos roles ao enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'developer';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'leader';

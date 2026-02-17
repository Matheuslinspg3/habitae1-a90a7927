-- Deletar imagens associadas aos imóveis incompletos
DELETE FROM property_images 
WHERE property_id IN (
  SELECT id FROM properties 
  WHERE source_provider IS NULL 
  AND address_street IS NULL
);

-- Deletar os imóveis incompletos (sem source_provider e sem endereço)
DELETE FROM properties 
WHERE source_provider IS NULL 
AND address_street IS NULL;
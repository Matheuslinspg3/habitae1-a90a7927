
# Plano: Limpeza de Marketplace + IDs Sequenciais Simples

## Problema Identificado

1. **884 registros orfaos no marketplace**: Quando imoveis sao deletados, o sistema nao remove a entrada correspondente em `marketplace_properties`. Resultado: marketplace mostra 1686 imoveis quando so existem 802 validos.

2. **Codigos de imovel complexos**: O sistema atual gera codigos como `0199011625` (10 digitos baseados em cidade+tipo+zona+sequencia). A decisao e simplificar para IDs sequenciais por organizacao: 1, 2, 3, 4...

---

## O que sera feito

### 1. Limpeza imediata dos orfaos

- Executar SQL para deletar os 884 registros em `marketplace_properties` que nao tem correspondencia em `properties`
- Tambem limpar registros de `marketplace_contact_access` que referenciam esses orfaos

### 2. Prevenir orfaos no futuro

**No codigo (`useProperties.ts`):**
- Adicionar `supabase.from('marketplace_properties').delete().eq('id', id)` nos fluxos de `deleteProperty` e `bulkDeleteProperties`, antes de deletar o imovel principal

**No banco (trigger automatico):**
- Criar trigger `trigger_cascade_marketplace_delete` na tabela `properties` que, ao deletar um imovel, remove automaticamente o registro correspondente em `marketplace_properties` (camada de seguranca adicional caso o frontend falhe)

### 3. Substituir IDs inteligentes por sequenciais

**Migracoes de banco:**
- Alterar a funcao `auto_generate_property_code` para gerar um numero sequencial por organizacao (1, 2, 3...) em vez do codigo complexo atual
- Recalcular todos os `property_code` existentes com sequenciais baseados na ordem de criacao (`created_at`)
- Remover/simplificar as tabelas auxiliares `city_codes`, `zone_codes`, `property_type_codes` que deixam de ser necessarias para geracao de codigo

**No frontend:**
- Manter a exibicao do `property_code` nos cards e listas (ja funciona)
- Simplificar o componente `PropertyCodeSearch` para buscar por numero simples
- Remover a funcao RPC `search_properties_by_code` complexa e substituir por busca direta no campo

---

## Detalhes Tecnicos

### Migracoes SQL

```text
-- 1. Limpar orfaos
DELETE FROM marketplace_contact_access
WHERE marketplace_property_id NOT IN (SELECT id FROM properties);

DELETE FROM marketplace_properties
WHERE id NOT IN (SELECT id FROM properties);

-- 2. Trigger cascata
CREATE OR REPLACE FUNCTION cascade_delete_marketplace()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM marketplace_properties WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_cascade_marketplace_delete
  AFTER DELETE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION cascade_delete_marketplace();

-- 3. Redefinir property_code como sequencial por org
CREATE OR REPLACE FUNCTION auto_generate_property_code()
RETURNS TRIGGER AS $$
DECLARE
  v_next INT;
BEGIN
  IF NEW.property_code IS NULL THEN
    SELECT COALESCE(MAX(property_code::int), 0) + 1
    INTO v_next
    FROM properties
    WHERE organization_id = NEW.organization_id
      AND property_code ~ '^\d+$';
    NEW.property_code := COALESCE(v_next, 1)::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recalcular codigos existentes
WITH ranked AS (
  SELECT id, organization_id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id ORDER BY created_at
    ) as seq
  FROM properties
)
UPDATE properties p
SET property_code = r.seq::text
FROM ranked r
WHERE p.id = r.id;
```

### Arquivos a modificar

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useProperties.ts` | Adicionar delete marketplace em deleteProperty e bulkDeleteProperties |
| `src/components/properties/PropertyCard.tsx` | Exibir `#1` em vez de `#0199011625` (ja funciona automaticamente) |
| `src/components/properties/PropertyCodeSearch.tsx` | Simplificar busca para campo numerico |
| `src/components/properties/PropertyListItem.tsx` | Nenhuma mudanca necessaria (ja usa property_code) |
| `src/components/marketplace/MarketplacePropertyCard.tsx` | Nenhuma mudanca (usa external_code do marketplace) |

### Riscos e mitigacoes

- **Codigos duplicados durante transicao**: O recalculo usa `ROW_NUMBER` por org, garantindo unicidade
- **Links externos com codigo antigo**: Se algum QR code ou landing page usa o codigo antigo, deixara de funcionar. Considerar isso aceitavel conforme decisao do usuario
- **Marketplace publish futuro**: O `external_code` no marketplace continuara sendo preenchido com o `property_code` (agora sequencial)

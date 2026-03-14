-- 1. Soft-delete duplicate leads (keep the oldest, deactivate newer copies)
-- Aretuza Machado duplicate
UPDATE leads SET is_active = false 
WHERE id = 'e441daca-c472-4190-ae71-4ec653438b94';

-- Kelly duplicate  
UPDATE leads SET is_active = false
WHERE id = '779b9475-296c-43c1-948c-953639d60ff4';

-- 2. Create unique partial index to prevent future race condition duplicates
-- This prevents two active leads with the same email in the same org
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unique_email_per_org 
ON leads (organization_id, lower(email)) 
WHERE is_active = true AND email IS NOT NULL;

-- 3. Create unique partial index for external_id dedup
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_unique_external_id_per_org
ON leads (organization_id, external_source, external_id)
WHERE is_active = true AND external_id IS NOT NULL;
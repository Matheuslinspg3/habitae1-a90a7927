import { supabase } from '@/integrations/supabase/client';

export interface DuplicatePropertyMatch {
  id: string;
  title: string | null;
  property_code: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  status: string;
}

function normalizeAddress(street: string | null | undefined): string {
  if (!street) return '';
  return street
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\b(rua|r\.|av\.|avenida|alameda|al\.|travessa|tv\.|praca|pca\.)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNumber(num: string | null | undefined): string {
  if (!num) return '';
  return num.trim().replace(/\D/g, '');
}

/**
 * Check for existing properties with matching address_street + address_number
 * within the user's organization.
 */
export async function findDuplicateProperties(
  addressStreet: string | null | undefined,
  addressNumber: string | null | undefined,
  excludeId?: string,
  addressComplement?: string | null
): Promise<DuplicatePropertyMatch[]> {
  const normalizedStreet = normalizeAddress(addressStreet);
  const normalizedNumber = normalizeNumber(addressNumber);

  // Need at least street to check
  if (!normalizedStreet) return [];

  // Fetch properties with addresses from the organization
  const { data: properties, error } = await supabase
    .from('properties')
    .select('id, title, property_code, address_street, address_number, address_complement, address_neighborhood, address_city, status')
    .not('address_street', 'is', null);

  if (error || !properties) return [];

  const normalizedComplement = addressComplement?.trim().toLowerCase() || '';

  return properties.filter(p => {
    if (excludeId && p.id === excludeId) return false;
    const pStreet = normalizeAddress(p.address_street);
    const pNumber = normalizeNumber(p.address_number);
    
    if (!pStreet) return false;
    
    // Check if streets match (contains comparison for flexibility)
    const streetMatch = pStreet.includes(normalizedStreet) || normalizedStreet.includes(pStreet);
    
    // If both have numbers, they must match
    if (normalizedNumber && pNumber) {
      if (!streetMatch || pNumber !== normalizedNumber) return false;
    } else if (!normalizedNumber && !pNumber) {
      if (!streetMatch) return false;
    } else {
      if (!streetMatch) return false;
    }

    // If complement is provided, only flag as duplicate if complements also match (or both empty)
    if (normalizedComplement) {
      const pComplement = (p as any).address_complement?.trim().toLowerCase() || '';
      if (pComplement && pComplement !== normalizedComplement) return false;
    }

    return true;
  });
}

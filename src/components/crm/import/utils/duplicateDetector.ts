import { supabase } from '@/integrations/supabase/client';

export interface DuplicateResult {
  newLeads: any[];
  duplicates: any[];
  errors: any[];
}

export async function detectDuplicates(
  leads: any[],
  fieldMappings: Record<string, string | null>
): Promise<DuplicateResult> {
  const emailField = Object.entries(fieldMappings).find(([, v]) => v === 'email')?.[0];
  const phoneField = Object.entries(fieldMappings).find(([, v]) => v === 'phone')?.[0];

  // Fetch existing leads
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('id, email, phone, name')
    .eq('is_active', true);

  const existingEmails = new Set(
    (existingLeads || [])
      .filter(l => l.email)
      .map(l => l.email!.toLowerCase().trim())
  );
  const existingPhones = new Set(
    (existingLeads || [])
      .filter(l => l.phone)
      .map(l => l.phone!.replace(/\D/g, ''))
  );

  const newLeads: any[] = [];
  const duplicates: any[] = [];
  const errors: any[] = [];

  for (const lead of leads) {
    try {
      const email = emailField ? lead[emailField]?.toLowerCase()?.trim() : null;
      const phone = phoneField ? lead[phoneField]?.replace(/\D/g, '') : null;

      const isDuplicate =
        (email && existingEmails.has(email)) ||
        (phone && phone.length >= 8 && existingPhones.has(phone));

      if (isDuplicate) {
        duplicates.push(lead);
      } else {
        newLeads.push(lead);
      }
    } catch {
      errors.push(lead);
    }
  }

  return { newLeads, duplicates, errors };
}

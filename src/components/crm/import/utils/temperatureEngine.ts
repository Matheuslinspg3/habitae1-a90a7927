export type Temperature = 'frio' | 'morno' | 'quente';

interface LeadInput {
  phone?: string;
  email?: string;
  source?: string;
  created_at?: string;
}

const HOT_SOURCES = ['facebook ads', 'portal pago', 'google ads', 'meta ads'];

export function classifyTemperature(lead: LeadInput): Temperature {
  const hasPhone = !!lead.phone?.trim();
  const hasEmail = !!lead.email?.trim();
  const source = (lead.source || '').toLowerCase();

  // Hot sources
  if (HOT_SOURCES.some(s => source.includes(s))) return 'quente';

  // Recently created
  if (lead.created_at) {
    const created = new Date(lead.created_at);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    if (created > threeDaysAgo) return 'quente';
  }

  if (hasPhone && hasEmail) return 'quente';
  if (hasPhone || hasEmail) return 'morno';
  return 'frio';
}

export function getTemperatureLabel(temp: Temperature): string {
  return { frio: 'Frio', morno: 'Morno', quente: 'Quente' }[temp];
}

export function getTemperatureColor(temp: Temperature): string {
  return { frio: 'text-blue-500', morno: 'text-yellow-500', quente: 'text-red-500' }[temp];
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays } from 'date-fns';

export interface AdInsight {
  id: string;
  organization_id: string;
  provider: 'meta' | 'google';
  entity_type: string;
  external_id: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  ctr: number | null;
  cpc: number | null;
  cpl: number | null;
}

export interface AggregatedInsight {
  external_id: string;
  ad_name?: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpl: number;
}

export function useAdInsights(externalId?: string, dateRange?: { from: Date; to: Date }) {
  const { profile } = useAuth();
  const from = dateRange?.from || subDays(new Date(), 7);
  const to = dateRange?.to || new Date();

  return useQuery({
    queryKey: ['ad-insights', profile?.organization_id, externalId, format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      let query = supabase
        .from('ad_insights_daily')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .gte('date', format(from, 'yyyy-MM-dd'))
        .lte('date', format(to, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (externalId) {
        query = query.eq('external_id', externalId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AdInsight[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useAggregatedInsights(dateRange?: { from: Date; to: Date }) {
  const { profile } = useAuth();
  const from = dateRange?.from || subDays(new Date(), 7);
  const to = dateRange?.to || new Date();

  return useQuery({
    queryKey: ['ad-insights-aggregated', profile?.organization_id, format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data: insights, error } = await supabase
        .from('ad_insights_daily')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .gte('date', format(from, 'yyyy-MM-dd'))
        .lte('date', format(to, 'yyyy-MM-dd'));

      if (error) throw error;

      // Get ad names
      const { data: ads } = await supabase
        .from('ad_entities')
        .select('external_id, name')
        .eq('organization_id', profile.organization_id)
        .eq('entity_type', 'ad' as any);

      const nameMap: Record<string, string> = {};
      (ads || []).forEach((a: any) => { nameMap[a.external_id] = a.name; });

      // Aggregate by external_id
      const map: Record<string, AggregatedInsight> = {};
      (insights || []).forEach((i: any) => {
        if (!map[i.external_id]) {
          map[i.external_id] = {
            external_id: i.external_id,
            ad_name: nameMap[i.external_id] || i.external_id,
            impressions: 0, clicks: 0, spend: 0, leads: 0, ctr: 0, cpc: 0, cpl: 0,
          };
        }
        const m = map[i.external_id];
        m.impressions += i.impressions || 0;
        m.clicks += i.clicks || 0;
        m.spend += Number(i.spend) || 0;
        m.leads += i.leads || 0;
      });

      return Object.values(map).map(m => ({
        ...m,
        ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
        cpc: m.clicks > 0 ? m.spend / m.clicks : 0,
        cpl: m.leads > 0 ? m.spend / m.leads : 0,
      }));
    },
    enabled: !!profile?.organization_id,
  });
}

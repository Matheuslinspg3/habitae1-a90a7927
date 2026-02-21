import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AdEntity {
  id: string;
  organization_id: string;
  provider: 'meta' | 'google';
  entity_type: 'campaign' | 'adset' | 'ad';
  external_id: string;
  name: string;
  status: string | null;
  thumbnail_url: string | null;
  parent_external_id: string | null;
  created_at: string;
  updated_at: string;
  new_leads_count?: number;
}

export function useAdEntities(search?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['ad-entities', profile?.organization_id, search],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      let query = supabase
        .from('ad_entities')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('entity_type', 'ad' as any)
        .order('updated_at', { ascending: false });

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get new leads count per ad
      const { data: leadCounts } = await supabase
        .from('ad_leads')
        .select('external_ad_id')
        .eq('organization_id', profile.organization_id)
        .eq('status', 'new' as any);

      const countMap: Record<string, number> = {};
      (leadCounts || []).forEach((l: any) => {
        countMap[l.external_ad_id] = (countMap[l.external_ad_id] || 0) + 1;
      });

      return (data as AdEntity[]).map(e => ({
        ...e,
        new_leads_count: countMap[e.external_id] || 0,
      }));
    },
    enabled: !!profile?.organization_id,
  });
}

export function useAdEntity(externalId?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['ad-entity', profile?.organization_id, externalId],
    queryFn: async () => {
      if (!profile?.organization_id || !externalId) return null;
      const { data, error } = await supabase
        .from('ad_entities')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('external_id', externalId)
        .eq('entity_type', 'ad' as any)
        .maybeSingle();

      if (error) throw error;
      return data as AdEntity | null;
    },
    enabled: !!profile?.organization_id && !!externalId,
  });
}

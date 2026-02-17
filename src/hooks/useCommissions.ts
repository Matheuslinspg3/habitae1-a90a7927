import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Commission = Tables<'commissions'> & {
  contract?: { id: string; code: string } | null;
  broker?: { id: string; full_name: string } | null;
};

export function useCommissions() {
  const { data: commissions = [], isLoading, error } = useQuery({
    queryKey: ['commissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          *,
          contract:contracts(id, code)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch broker names separately since it's a profiles join
      const brokerIds = [...new Set(data.map(c => c.broker_id))];
      const { data: brokersRaw } = await supabase
        .from('profiles_public' as any)
        .select('user_id, full_name')
        .in('user_id', brokerIds);
      const brokers = (brokersRaw as unknown) as { user_id: string; full_name: string }[] | null;

      const brokersMap = new Map(brokers?.map(b => [b.user_id, b]) || []);

      return data.map(c => ({
        ...c,
        broker: brokersMap.get(c.broker_id) ? {
          id: c.broker_id,
          full_name: brokersMap.get(c.broker_id)?.full_name || 'Desconhecido'
        } : null
      })) as Commission[];
    },
  });

  const stats = {
    totalPaid: commissions.filter(c => c.paid).reduce((acc, c) => acc + Number(c.amount), 0),
    totalPending: commissions.filter(c => !c.paid).reduce((acc, c) => acc + Number(c.amount), 0),
    count: commissions.length,
  };

  return {
    commissions,
    isLoading,
    error,
    stats,
  };
}

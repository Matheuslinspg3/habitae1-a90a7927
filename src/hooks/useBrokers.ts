import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Broker = {
  id: string;
  user_id: string;
  full_name: string;
};

export function useBrokers() {
  const { user } = useAuth();

  const { data: brokers = [], isLoading, error } = useQuery({
    queryKey: ['brokers'],
    queryFn: async () => {
      // Use the public view to avoid exposing sensitive fields (phone, creci, etc.)
      const { data, error } = await supabase
        .from('profiles_public' as any)
        .select('id, user_id, full_name')
        .order('full_name');

      if (error) throw error;
      return (data as unknown) as Broker[];
    },
    enabled: !!user,
  });

  return {
    brokers,
    isLoading,
    error,
  };
}

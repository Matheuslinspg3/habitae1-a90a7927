import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function usePropertyLocations() {
  const { user } = useAuth();

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ['property-neighborhoods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('address_neighborhood')
        .not('address_neighborhood', 'is', null)
        .order('address_neighborhood');

      if (error) throw error;
      const unique = [...new Set(data.map(d => d.address_neighborhood!).filter(Boolean))];
      return unique.sort();
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: cities = [] } = useQuery({
    queryKey: ['property-cities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('address_city')
        .not('address_city', 'is', null)
        .order('address_city');

      if (error) throw error;
      const unique = [...new Set(data.map(d => d.address_city!).filter(Boolean))];
      return unique.sort();
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return { neighborhoods, cities };
}

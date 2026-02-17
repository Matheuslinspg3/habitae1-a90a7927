import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PropertyFilters } from './usePropertyFilters';
import { toast } from 'sonner';

interface SavedSearch {
  id: string;
  name: string;
  filters: PropertyFilters;
  notify_new_matches: boolean;
  created_at: string;
}

export function useSavedSearches() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: savedSearches = [], isLoading } = useQuery({
    queryKey: ['saved-searches', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(s => ({
        ...s,
        filters: s.filters as unknown as PropertyFilters,
      })) as SavedSearch[];
    },
    enabled: !!user?.id,
  });

  const saveSearch = useMutation({
    mutationFn: async ({ name, filters, notify }: { name: string; filters: PropertyFilters; notify: boolean }) => {
      if (!user?.id || !profile?.organization_id) throw new Error('Not authenticated');
      const { error } = await supabase.from('saved_searches').insert({
        user_id: user.id,
        organization_id: profile.organization_id,
        name,
        filters: filters as any,
        notify_new_matches: notify,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
      toast.success('Busca salva com sucesso!');
    },
    onError: () => toast.error('Erro ao salvar busca'),
  });

  const deleteSearch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_searches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
      toast.success('Busca removida');
    },
    onError: () => toast.error('Erro ao remover busca'),
  });

  return {
    savedSearches,
    isLoading,
    saveSearch: saveSearch.mutate,
    deleteSearch: deleteSearch.mutate,
    isSaving: saveSearch.isPending,
  };
}

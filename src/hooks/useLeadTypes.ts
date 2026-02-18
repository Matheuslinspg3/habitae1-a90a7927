import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type LeadType = Tables<'lead_types'>;

export function useLeadTypes() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: leadTypes = [], isLoading, error } = useQuery({
    queryKey: ['lead-types', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Seed default types for this org if none exist
      await supabase.rpc('seed_org_lead_types', { p_org_id: profile.organization_id });

      const { data, error } = await supabase
        .from('lead_types')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as LeadType[];
    },
    enabled: !!profile?.organization_id,
  });

  const createLeadType = useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }) => {
      if (!profile?.organization_id) {
        throw new Error('Organização não encontrada');
      }
      const maxPosition = leadTypes.length > 0
        ? Math.max(...leadTypes.map(t => t.position ?? 0)) + 1
        : 0;
      const { data, error } = await supabase
        .from('lead_types')
        .insert({ name, color: color || '#6366f1', is_default: false, organization_id: profile.organization_id, position: maxPosition })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-types'] });
      toast({
        title: 'Estágio criado',
        description: 'O estágio de lead foi criado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar estágio',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateLeadType = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color?: string }) => {
      const { data, error } = await supabase
        .from('lead_types')
        .update({ name, color })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-types'] });
      toast({
        title: 'Estágio atualizado',
        description: 'O estágio de lead foi atualizado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar estágio',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteLeadType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lead_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-types'] });
      toast({
        title: 'Estágio removido',
        description: 'O estágio de lead foi removido com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover estágio',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const reorderTypes = useMutation({
    mutationFn: async (updates: { id: string; position: number }[]) => {
      const promises = updates.map(({ id, position }) =>
        supabase.from('lead_types').update({ position }).eq('id', id)
      );
      const results = await Promise.all(promises);
      const firstError = results.find(r => r.error);
      if (firstError?.error) throw firstError.error;
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['lead-types', profile?.organization_id] });
      const previous = queryClient.getQueryData<LeadType[]>(['lead-types', profile?.organization_id]);
      queryClient.setQueryData<LeadType[]>(['lead-types', profile?.organization_id], (old) => {
        if (!old) return old;
        const posMap = new Map(updates.map(u => [u.id, u.position]));
        return [...old].map(t => posMap.has(t.id) ? { ...t, position: posMap.get(t.id)! } : t)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['lead-types', profile?.organization_id], context.previous);
      }
      toast({ title: 'Erro ao reordenar tipos', description: _error.message, variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-types'] });
    },
  });

  return {
    leadTypes,
    isLoading,
    error,
    createLeadType: createLeadType.mutate,
    updateLeadType: updateLeadType.mutate,
    deleteLeadType: deleteLeadType.mutate,
    reorderTypes: reorderTypes.mutate,
    isCreating: createLeadType.isPending,
    isUpdating: updateLeadType.isPending,
    isDeleting: deleteLeadType.isPending,
  };
}

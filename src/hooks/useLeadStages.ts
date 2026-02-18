import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type LeadStage = {
  id: string;
  name: string;
  color: string;
  position: number;
  organization_id: string | null;
  is_default: boolean;
  is_win: boolean;
  is_loss: boolean;
  created_at: string;
};

export function useLeadStages() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: leadStages = [], isLoading, error } = useQuery({
    queryKey: ['lead-stages', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Seed default stages for this org if none exist
      await supabase.rpc('seed_org_lead_stages', { p_org_id: profile.organization_id });

      const { data, error } = await supabase
        .from('lead_stages')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as LeadStage[];
    },
    enabled: !!profile?.organization_id,
  });

  const createLeadStage = useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }) => {
      if (!profile?.organization_id) {
        throw new Error('Organização não encontrada');
      }
      const maxPosition = leadStages.length > 0 
        ? Math.max(...leadStages.map(s => s.position)) + 1 
        : 0;

      const { data, error } = await supabase
        .from('lead_stages')
        .insert({
          name,
          color: color || '#64748b',
          position: maxPosition,
          is_default: false,
          is_win: false,
          is_loss: false,
          organization_id: profile.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-stages'] });
      toast({ title: 'Tipo criado', description: 'O tipo foi criado com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar tipo', description: error.message, variant: 'destructive' });
    },
  });

  const updateLeadStage = useMutation({
    mutationFn: async ({ id, name, color, is_win, is_loss }: { id: string; name: string; color?: string; is_win?: boolean; is_loss?: boolean }) => {
      const updateData: Record<string, any> = { name };
      if (color !== undefined) updateData.color = color;
      if (is_win !== undefined) updateData.is_win = is_win;
      if (is_loss !== undefined) updateData.is_loss = is_loss;

      const { data, error } = await supabase
        .from('lead_stages')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-stages'] });
      toast({ title: 'Tipo atualizado', description: 'O tipo foi atualizado com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar tipo', description: error.message, variant: 'destructive' });
    },
  });

  const deleteLeadStage = useMutation({
    mutationFn: async (id: string) => {
      // First, nullify leads referencing this stage to avoid FK constraint
      await supabase
        .from('leads')
        .update({ lead_stage_id: null })
        .eq('lead_stage_id', id);

      const { error } = await supabase
        .from('lead_stages')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-stages'] });
      toast({ title: 'Tipo removido', description: 'O tipo foi removido com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover tipo', description: error.message, variant: 'destructive' });
    },
  });

  const reorderStages = useMutation({
    mutationFn: async (updates: { id: string; position: number }[]) => {
      const promises = updates.map(({ id, position }) =>
        supabase.from('lead_stages').update({ position }).eq('id', id)
      );
      const results = await Promise.all(promises);
      const firstError = results.find(r => r.error);
      if (firstError?.error) throw firstError.error;
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['lead-stages', profile?.organization_id] });
      const previous = queryClient.getQueryData<LeadStage[]>(['lead-stages', profile?.organization_id]);
      queryClient.setQueryData<LeadStage[]>(['lead-stages', profile?.organization_id], (old) => {
        if (!old) return old;
        const posMap = new Map(updates.map(u => [u.id, u.position]));
        return [...old].map(s => posMap.has(s.id) ? { ...s, position: posMap.get(s.id)! } : s)
          .sort((a, b) => a.position - b.position);
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['lead-stages', profile?.organization_id], context.previous);
      }
      toast({ title: 'Erro ao reordenar tipos', description: _error.message, variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-stages'] });
    },
  });

  return {
    leadStages,
    isLoading,
    error,
    createLeadStage: createLeadStage.mutate,
    updateLeadStage: updateLeadStage.mutate,
    deleteLeadStage: deleteLeadStage.mutate,
    reorderStages: reorderStages.mutate,
    isCreating: createLeadStage.isPending,
    isUpdating: updateLeadStage.isPending,
    isDeleting: deleteLeadStage.isPending,
  };
}

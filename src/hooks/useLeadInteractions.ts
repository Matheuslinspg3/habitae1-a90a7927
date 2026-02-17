import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables, Enums } from '@/integrations/supabase/types';

export type LeadInteraction = Tables<'lead_interactions'>;
export type InteractionType = Enums<'interaction_type'>;

export const INTERACTION_TYPES: { id: InteractionType; label: string; icon: string }[] = [
  { id: 'ligacao', label: 'Ligação', icon: 'Phone' },
  { id: 'email', label: 'E-mail', icon: 'Mail' },
  { id: 'visita', label: 'Visita', icon: 'MapPin' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle' },
  { id: 'reuniao', label: 'Reunião', icon: 'Users' },
  { id: 'nota', label: 'Nota', icon: 'FileText' },
];

export function useLeadInteractions(leadId: string | null) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: interactions = [], isLoading } = useQuery({
    queryKey: ['lead-interactions', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('lead_interactions')
        .select('*')
        .eq('lead_id', leadId)
        .order('occurred_at', { ascending: false });

      if (error) throw error;
      return data as LeadInteraction[];
    },
    enabled: !!leadId && !!user,
  });

  const createInteraction = useMutation({
    mutationFn: async (input: { type: InteractionType; description: string; occurred_at?: string }) => {
      if (!user || !leadId) throw new Error('Dados insuficientes');

      const { data, error } = await supabase
        .from('lead_interactions')
        .insert({
          lead_id: leadId,
          created_by: user.id,
          type: input.type,
          description: input.description,
          ...(input.occurred_at ? { occurred_at: input.occurred_at } : {}),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-interactions', leadId] });
      toast({ title: 'Interação registrada' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao registrar interação', description: error.message, variant: 'destructive' });
    },
  });

  return {
    interactions,
    isLoading,
    createInteraction: createInteraction.mutate,
    isCreating: createInteraction.isPending,
  };
}

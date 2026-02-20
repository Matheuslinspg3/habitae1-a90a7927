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

export interface CreateInteractionInput {
  type: InteractionType;
  description: string;
  occurred_at?: string;
  addToSchedule?: boolean;
  leadName?: string;
}

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
    mutationFn: async (input: CreateInteractionInput) => {
      if (!user || !leadId) throw new Error('Dados insuficientes');

      // 1. Get user profile for organization_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      // 2. Create the interaction
      const { data: interaction, error } = await supabase
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

      // 3. If addToSchedule, create linked appointment
      if (input.addToSchedule && interaction) {
        const typeLabel = INTERACTION_TYPES.find(t => t.id === input.type)?.label || input.type;
        const leadLabel = input.leadName || 'Lead';
        const occurredAt = input.occurred_at ? new Date(input.occurred_at) : new Date();
        const endTime = new Date(occurredAt.getTime() + 30 * 60 * 1000); // +30min
        const isPast = occurredAt < new Date();

        const { data: appointment, error: aptError } = await supabase
          .from('appointments')
          .insert({
            title: `${typeLabel} - ${leadLabel}`,
            start_time: occurredAt.toISOString(),
            end_time: endTime.toISOString(),
            lead_id: leadId,
            organization_id: profile.organization_id,
            created_by: user.id,
            interaction_id: interaction.id,
            completed: isPast,
            description: input.description,
          })
          .select()
          .single();

        if (!aptError && appointment) {
          // Update interaction with appointment_id
          await supabase
            .from('lead_interactions')
            .update({ appointment_id: appointment.id })
            .eq('id', interaction.id);
        }
      }

      return interaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-interactions', leadId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
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

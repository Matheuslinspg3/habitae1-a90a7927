import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useBrokers, type Broker } from '@/hooks/useBrokers';
import type { Lead } from '@/hooks/useLeads';

export interface BrokerWithStats extends Broker {
  activeLeads: number;
  coldLeads: number;
  wonLeads: number;
  score: number;
}

/**
 * Calculates a weighted score for the broker roulette.
 * Lower score = higher priority for receiving new leads.
 * Factors:
 *  - activeLeads: penalizes brokers with more current leads
 *  - coldLeads (fechado_perdido): penalizes brokers with high loss ratio
 *  - wonLeads (fechado_ganho): rewards brokers with high win ratio
 */
function calculateBrokerScore(stats: { activeLeads: number; coldLeads: number; wonLeads: number }): number {
  const { activeLeads, coldLeads, wonLeads } = stats;
  // Base load penalty (biggest weight — distribute evenly)
  const loadPenalty = activeLeads * 10;
  // Cold leads penalty
  const coldPenalty = coldLeads * 3;
  // Won leads bonus (negative = better)
  const winBonus = wonLeads * -2;
  // Small random jitter to break ties
  const jitter = Math.random() * 2;

  return loadPenalty + coldPenalty + winBonus + jitter;
}

export function useLeadAssignment() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { brokers } = useBrokers();

  /**
   * Get brokers with lead stats for the roulette algorithm.
   */
  const getBrokersWithStats = async (): Promise<BrokerWithStats[]> => {
    if (!profile?.organization_id) return [];

    // Get all active leads with broker_id to compute stats
    const { data: allLeads, error } = await supabase
      .from('leads')
      .select('broker_id, stage, is_active')
      .eq('organization_id', profile.organization_id);

    if (error) {
      console.error('Error fetching lead stats:', error);
      return brokers.map(b => ({ ...b, activeLeads: 0, coldLeads: 0, wonLeads: 0, score: 0 }));
    }

    return brokers.map(broker => {
      const brokerLeads = (allLeads || []).filter(l => l.broker_id === broker.user_id);
      const activeLeads = brokerLeads.filter(l => l.is_active && !['fechado_ganho', 'fechado_perdido'].includes(l.stage)).length;
      const coldLeads = brokerLeads.filter(l => l.stage === 'fechado_perdido').length;
      const wonLeads = brokerLeads.filter(l => l.stage === 'fechado_ganho').length;
      const score = calculateBrokerScore({ activeLeads, coldLeads, wonLeads });

      return { ...broker, activeLeads, coldLeads, wonLeads, score };
    });
  };

  /**
   * Pick the best broker via roulette (lowest score wins).
   */
  const pickBrokerByRoulette = async (): Promise<BrokerWithStats | null> => {
    const brokersWithStats = await getBrokersWithStats();
    if (brokersWithStats.length === 0) return null;

    // Sort by score ascending (lowest = best candidate)
    const sorted = [...brokersWithStats].sort((a, b) => a.score - b.score);
    return sorted[0];
  };

  /**
   * Assign a lead to a broker and create a notification.
   */
  const assignLead = useMutation({
    mutationFn: async ({ leadId, brokerId, brokerName }: { leadId: string; brokerId: string; brokerName: string }) => {
      if (!profile?.organization_id) throw new Error('Sem organização');

      // Update lead with broker_id
      const { error: updateErr } = await supabase
        .from('leads')
        .update({ broker_id: brokerId })
        .eq('id', leadId);

      if (updateErr) throw updateErr;

      // Get lead name for notification
      const { data: lead } = await supabase
        .from('leads')
        .select('name')
        .eq('id', leadId)
        .single();

      // Create notification for the broker
      const { error: notifErr } = await supabase
        .from('notifications')
        .insert({
          user_id: brokerId,
          organization_id: profile.organization_id,
          type: 'lead_assigned',
          title: 'Novo lead atribuído',
          message: `O lead "${lead?.name || 'Novo'}" foi destinado a você.`,
          entity_id: leadId,
          entity_type: 'lead',
        });

      if (notifErr) {
        console.error('Error creating notification:', notifErr);
        // Non-blocking: don't throw, assignment still succeeded
      }

      return { leadId, brokerId, brokerName };
    },
    onSuccess: ({ brokerName }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: 'Lead atribuído',
        description: `Lead destinado a ${brokerName} com sucesso. O corretor foi notificado.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atribuir lead',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    brokers,
    getBrokersWithStats,
    pickBrokerByRoulette,
    assignLead: assignLead.mutate,
    assignLeadAsync: assignLead.mutateAsync,
    isAssigning: assignLead.isPending,
  };
}

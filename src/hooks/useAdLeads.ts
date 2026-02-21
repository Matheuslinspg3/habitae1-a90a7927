import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type AdLeadStatus = 'new' | 'read' | 'sent_to_crm' | 'send_failed' | 'archived';

export interface AdLead {
  id: string;
  organization_id: string;
  provider: 'meta' | 'google';
  external_lead_id: string;
  external_ad_id: string;
  external_form_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_time: string;
  status: AdLeadStatus;
  status_reason: string | null;
  raw_payload: any;
  crm_record_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useAdLeads(filters?: { externalAdId?: string; status?: AdLeadStatus; search?: string }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ['ad-leads', profile?.organization_id, filters],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      let query = supabase
        .from('ad_leads')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_time', { ascending: false });

      if (filters?.externalAdId) {
        query = query.eq('external_ad_id', filters.externalAdId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AdLead[];
    },
    enabled: !!profile?.organization_id,
  });

  const newLeadsCount = leads.filter(l => l.status === 'new').length;

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, statusReason }: { id: string; status: AdLeadStatus; statusReason?: string }) => {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (statusReason !== undefined) updateData.status_reason = statusReason;
      const { error } = await supabase.from('ad_leads').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-leads'] });
      queryClient.invalidateQueries({ queryKey: ['ad-leads-count'] });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const sendToCrm = useMutation({
    mutationFn: async ({ leadId, stageId }: { leadId: string; stageId: string }) => {
      const lead = leads.find(l => l.id === leadId);
      if (!lead || !profile?.organization_id) throw new Error('Lead não encontrado');

      // Create lead in CRM
      const { data: crmLead, error: crmError } = await supabase
        .from('leads')
        .insert({
          name: lead.name || 'Lead de Anúncio',
          email: lead.email,
          phone: lead.phone,
          organization_id: profile.organization_id,
          created_by: (await supabase.auth.getUser()).data.user!.id,
          lead_stage_id: stageId,
          stage: 'novo',
          source: 'anuncio',
          notes: `Lead importado de anúncio Meta Ads (Ad ID: ${lead.external_ad_id})`,
        })
        .select('id')
        .single();

      if (crmError) {
        // Mark as failed
        await supabase.from('ad_leads').update({
          status: 'send_failed' as any,
          status_reason: crmError.message,
          updated_at: new Date().toISOString(),
        }).eq('id', leadId);
        throw crmError;
      }

      // Mark as sent
      await supabase.from('ad_leads').update({
        status: 'sent_to_crm' as any,
        crm_record_id: crmLead.id,
        updated_at: new Date().toISOString(),
      }).eq('id', leadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-leads'] });
      queryClient.invalidateQueries({ queryKey: ['ad-leads-count'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Enviado ao CRM', description: 'Lead enviado ao CRM com sucesso.' });
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['ad-leads'] });
      toast({ title: 'Falha ao enviar ao CRM', description: error.message, variant: 'destructive' });
    },
  });

  return {
    leads,
    isLoading,
    refetch,
    newLeadsCount,
    updateStatus: updateStatus.mutate,
    sendToCrm: sendToCrm.mutate,
    isSending: sendToCrm.isPending,
  };
}

export function useAdLeadsCount(externalAdId?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['ad-leads-count', profile?.organization_id, externalAdId],
    queryFn: async () => {
      if (!profile?.organization_id) return 0;
      let query = supabase
        .from('ad_leads')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .eq('status', 'new' as any);

      if (externalAdId) {
        query = query.eq('external_ad_id', externalAdId);
      }

      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
    },
    enabled: !!profile?.organization_id,
  });
}

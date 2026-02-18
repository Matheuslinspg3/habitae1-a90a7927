import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDemo } from '@/contexts/DemoContext';
import { useLeadStages, type LeadStage } from '@/hooks/useLeadStages';
import type { Tables } from '@/integrations/supabase/types';

export type Lead = Tables<'leads'> & {
  lead_type?: Tables<'lead_types'> | null;
  property?: { id: string; title: string } | null;
  broker?: { id: string; full_name: string } | null;
  interested_property_type?: Tables<'property_types'> | null;
};

export { type LeadStage } from '@/hooks/useLeadStages';

export const LEAD_SOURCES = [
  { id: 'site', label: 'Site' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'anuncio', label: 'Anúncio' },
  { id: 'indicacao', label: 'Indicação' },
  { id: 'porta', label: 'Porta' },
  { id: 'outro', label: 'Outro' },
] as const;

export const TEMPERATURES = [
  { id: 'frio', label: 'Frio', color: 'text-blue-500' },
  { id: 'morno', label: 'Morno', color: 'text-amber-500' },
  { id: 'quente', label: 'Quente', color: 'text-orange-500' },
  { id: 'prioridade', label: 'Prioridade Máxima', color: 'text-red-500' },
] as const;

export type CreateLeadInput = {
  name: string;
  phone?: string;
  email?: string;
  lead_type_id?: string;
  source?: string;
  interested_property_type_id?: string;
  interested_property_type_ids?: string[];
  property_id?: string;
  broker_id?: string;
  estimated_value?: number;
  lead_stage_id?: string;
  notes?: string;
  temperature?: string;
  transaction_interest?: string;
  min_bedrooms?: number;
  min_bathrooms?: number;
  min_parking?: number;
  min_area?: number;
  preferred_neighborhoods?: string[];
  preferred_cities?: string[];
  additional_requirements?: string;
};

export type UpdateLeadInput = Partial<CreateLeadInput> & { id: string };

// Demo mode fallback stages
const DEMO_STAGES: LeadStage[] = [
  { id: 'novo', name: 'Novos', color: '#64748b', position: 0, organization_id: null, is_default: true, is_win: false, is_loss: false, created_at: '' },
  { id: 'contato', name: 'Em Contato', color: '#3b82f6', position: 1, organization_id: null, is_default: true, is_win: false, is_loss: false, created_at: '' },
  { id: 'visita', name: 'Visita Agendada', color: '#eab308', position: 2, organization_id: null, is_default: true, is_win: false, is_loss: false, created_at: '' },
  { id: 'proposta', name: 'Proposta', color: '#f97316', position: 3, organization_id: null, is_default: true, is_win: false, is_loss: false, created_at: '' },
  { id: 'negociacao', name: 'Negociação', color: '#a855f7', position: 4, organization_id: null, is_default: true, is_win: false, is_loss: false, created_at: '' },
  { id: 'fechado_ganho', name: 'Fechado Ganho', color: '#22c55e', position: 5, organization_id: null, is_default: true, is_win: true, is_loss: false, created_at: '' },
  { id: 'fechado_perdido', name: 'Fechado Perdido', color: '#ef4444', position: 6, organization_id: null, is_default: true, is_win: false, is_loss: true, created_at: '' },
];

export function useLeads() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const queryClient = useQueryClient();
  const { leadStages: dynamicStages, isLoading: isLoadingStages } = useLeadStages();

  // Determine which stages to use
  const leadStages = isDemoMode ? DEMO_STAGES : dynamicStages;

  // Demo mode: return mock data
  if (isDemoMode) {
    const demoLeads = demoData.leads as unknown as Lead[];
    
    const leadsByStage = leadStages.reduce((acc, stage) => {
      acc[stage.id] = demoLeads.filter(lead => 
        lead.lead_stage_id === stage.id || lead.stage === stage.id
      );
      return acc;
    }, {} as Record<string, Lead[]>);

    const stageStats = leadStages.reduce((acc, stage) => {
      const stageLeads = leadsByStage[stage.id] || [];
      acc[stage.id] = {
        count: stageLeads.length,
        totalValue: stageLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0),
      };
      return acc;
    }, {} as Record<string, { count: number; totalValue: number }>);

    const demoMutate = () => {
      toast({
        title: 'Modo Demonstração',
        description: 'Os dados não serão salvos neste modo.',
      });
    };

    return {
      leads: demoLeads,
      inactiveLeads: [] as Lead[],
      leadStages,
      leadsByStage,
      stageStats,
      isLoading: false,
      isLoadingInactive: false,
      error: null,
      refetch: () => Promise.resolve({ data: demoLeads, error: null }),
      createLead: demoMutate,
      createLeadAsync: async () => { demoMutate(); return demoLeads[0]; },
      updateLead: demoMutate,
      updateLeadAsync: async () => { demoMutate(); return demoLeads[0]; },
      updateLeadStage: demoMutate,
      reorderLeads: demoMutate,
      deleteLead: demoMutate,
      inactivateLead: demoMutate,
      reactivateLead: demoMutate,
      bulkDeleteLeads: demoMutate,
      bulkInactivateLeads: demoMutate,
      bulkMoveStage: demoMutate,
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
      isInactivating: false,
      isReactivating: false,
    };
  }

  const { data: leads = [], isLoading: isLoadingLeads, error, refetch } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          lead_type:lead_types(*),
          interested_property_type:property_types(*)
        `)
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (error) throw error;
      
      // Fetch properties and brokers separately to avoid FK issues
      const propertyIds = [...new Set(data.filter(l => l.property_id).map(l => l.property_id!))];
      const brokerIds = [...new Set(data.filter(l => l.broker_id).map(l => l.broker_id!))];
      
      let propertiesMap: Record<string, { id: string; title: string }> = {};
      let brokersMap: Record<string, { id: string; full_name: string }> = {};
      
      if (propertyIds.length > 0) {
        const { data: properties } = await supabase
          .from('properties')
          .select('id, title')
          .in('id', propertyIds);
        if (properties) {
          propertiesMap = Object.fromEntries(properties.map(p => [p.id, p]));
        }
      }
      
      if (brokerIds.length > 0) {
        const { data: brokersRaw } = await supabase
          .from('profiles_public' as any)
          .select('id, user_id, full_name')
          .in('user_id', brokerIds);
        const brokers = (brokersRaw as unknown) as { id: string; user_id: string; full_name: string }[] | null;
        if (brokers) {
          brokersMap = Object.fromEntries(brokers.map(b => [b.user_id, { id: b.user_id, full_name: b.full_name }]));
        }
      }
      
      return data.map(lead => ({
        ...lead,
        property: lead.property_id ? propertiesMap[lead.property_id] || null : null,
        broker: lead.broker_id ? brokersMap[lead.broker_id] || null : null,
      })) as Lead[];
    },
    enabled: !!user,
  });

  // Query for inactive leads
  const { data: inactiveLeads = [], isLoading: isLoadingInactive } = useQuery({
    queryKey: ['leads', 'inactive'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          lead_type:lead_types(*),
          interested_property_type:property_types(*)
        `)
        .eq('is_active', false)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!user,
  });

  const isLoading = isLoadingLeads || isLoadingStages;

  const createLead = useMutation({
    mutationFn: async (input: CreateLeadInput) => {
      if (!user || !profile?.organization_id) {
        throw new Error('Usuário não autenticado');
      }

      const { lead_stage_id, ...rest } = input;
      const defaultStageId = leadStages[0]?.id;

      const { data, error } = await supabase
        .from('leads')
        .insert({
          ...rest,
          organization_id: profile.organization_id,
          created_by: user.id,
          lead_stage_id: lead_stage_id || defaultStageId,
          stage: 'novo', // keep old column satisfied (NOT NULL)
        })
        .select(`
          *,
          lead_type:lead_types(*)
        `)
        .single();

      if (error) throw error;
      return data as Lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead criado', description: 'O lead foi criado com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar lead', description: error.message, variant: 'destructive' });
    },
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, ...input }: UpdateLeadInput) => {
      const { data, error } = await supabase
        .from('leads')
        .update(input)
        .eq('id', id)
        .select(`
          *,
          lead_type:lead_types(*)
        `)
        .single();

      if (error) throw error;
      return data as Lead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead atualizado', description: 'O lead foi atualizado com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar lead', description: error.message, variant: 'destructive' });
    },
  });

  const updateLeadStage = useMutation({
    mutationFn: async ({ id, lead_stage_id }: { id: string; lead_stage_id: string }) => {
      const { data, error } = await supabase
        .from('leads')
        .update({ lead_stage_id })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, lead_stage_id }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previousLeads = queryClient.getQueryData<Lead[]>(['leads']);

      if (previousLeads) {
        queryClient.setQueryData<Lead[]>(['leads'], (old) =>
          (old || []).map((lead) =>
            lead.id === id ? { ...lead, lead_stage_id, updated_at: new Date().toISOString() } : lead
          )
        );
      }

      return { previousLeads };
    },
    onError: (error, _variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(['leads'], context.previousLeads);
      }
      toast({ title: 'Erro ao mover lead', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead removido', description: 'O lead foi removido com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover lead', description: error.message, variant: 'destructive' });
    },
  });

  const inactivateLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead inativado', description: 'O lead foi movido para a lista de inativos.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao inativar lead', description: error.message, variant: 'destructive' });
    },
  });

  const reactivateLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').update({ is_active: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: 'Lead reativado', description: 'O lead foi movido de volta para o Kanban.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao reativar lead', description: error.message, variant: 'destructive' });
    },
  });

  // ── Bulk operations ──
  const bulkDeleteLeads = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('leads').delete().in('id', ids);
      if (error) throw error;
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previous = queryClient.getQueryData<Lead[]>(['leads']);
      const idSet = new Set(ids);
      queryClient.setQueryData<Lead[]>(['leads'], (old) => (old || []).filter(l => !idSet.has(l.id)));
      return { previous };
    },
    onSuccess: (_d, ids) => {
      toast({ title: 'Leads removidos', description: `${ids.length} lead(s) removido(s) com sucesso.` });
    },
    onError: (error, _v, context) => {
      if (context?.previous) queryClient.setQueryData(['leads'], context.previous);
      toast({ title: 'Erro ao remover leads', description: error.message, variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  const bulkInactivateLeads = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('leads').update({ is_active: false }).in('id', ids);
      if (error) throw error;
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previous = queryClient.getQueryData<Lead[]>(['leads']);
      const idSet = new Set(ids);
      queryClient.setQueryData<Lead[]>(['leads'], (old) => (old || []).filter(l => !idSet.has(l.id)));
      return { previous };
    },
    onSuccess: (_d, ids) => {
      toast({ title: 'Leads inativados', description: `${ids.length} lead(s) movido(s) para inativos.` });
    },
    onError: (error, _v, context) => {
      if (context?.previous) queryClient.setQueryData(['leads'], context.previous);
      toast({ title: 'Erro ao inativar leads', description: error.message, variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  const bulkMoveStage = useMutation({
    mutationFn: async ({ ids, lead_stage_id }: { ids: string[]; lead_stage_id: string }) => {
      const { error } = await supabase.from('leads').update({ lead_stage_id }).in('id', ids);
      if (error) throw error;
    },
    onMutate: async ({ ids, lead_stage_id }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previous = queryClient.getQueryData<Lead[]>(['leads']);
      const idSet = new Set(ids);
      queryClient.setQueryData<Lead[]>(['leads'], (old) =>
        (old || []).map(l => idSet.has(l.id) ? { ...l, lead_stage_id } : l)
      );
      return { previous };
    },
    onError: (error, _v, context) => {
      if (context?.previous) queryClient.setQueryData(['leads'], context.previous);
      toast({ title: 'Erro ao mover leads', description: error.message, variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  const reorderLeads = useMutation({
    mutationFn: async (updates: { id: string; position: number; lead_stage_id: string }[]) => {
      const promises = updates.map(({ id, position, lead_stage_id }) =>
        supabase.from('leads').update({ position, lead_stage_id }).eq('id', id)
      );
      const results = await Promise.all(promises);
      const firstError = results.find(r => r.error);
      if (firstError?.error) throw firstError.error;
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] });
      const previousLeads = queryClient.getQueryData<Lead[]>(['leads']);

      if (previousLeads) {
        queryClient.setQueryData<Lead[]>(['leads'], (old) => {
          if (!old) return old;
          const updateMap = new Map(updates.map(u => [u.id, u]));
          return old.map(lead => {
            const update = updateMap.get(lead.id);
            if (update) {
              return { ...lead, position: update.position, lead_stage_id: update.lead_stage_id };
            }
            return lead;
          });
        });
      }

      return { previousLeads };
    },
    onError: (error, _variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(['leads'], context.previousLeads);
      }
      toast({ title: 'Erro ao reordenar leads', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  // Group leads by lead_stage_id (sorted by position from query)
  const leadsByStage = leadStages.reduce((acc, stage) => {
    acc[stage.id] = leads
      .filter(lead => lead.lead_stage_id === stage.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return acc;
  }, {} as Record<string, Lead[]>);

  // Add unclassified leads (null lead_stage_id)
  const unclassifiedLeads = leads
    .filter(lead => !lead.lead_stage_id || !leadStages.some(s => s.id === lead.lead_stage_id))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  leadsByStage['__unclassified__'] = unclassifiedLeads;

  // Calculate stats per stage
  const stageStats = leadStages.reduce((acc, stage) => {
    const stageLeads = leadsByStage[stage.id] || [];
    acc[stage.id] = {
      count: stageLeads.length,
      totalValue: stageLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0),
    };
    return acc;
  }, {} as Record<string, { count: number; totalValue: number }>);
  // Stats for unclassified
  stageStats['__unclassified__'] = {
    count: unclassifiedLeads.length,
    totalValue: unclassifiedLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0),
  };

  return {
    leads,
    inactiveLeads,
    leadStages,
    leadsByStage,
    stageStats,
    isLoading,
    isLoadingInactive,
    error,
    refetch,
    createLead: createLead.mutate,
    createLeadAsync: createLead.mutateAsync,
    updateLead: updateLead.mutate,
    updateLeadAsync: updateLead.mutateAsync,
    updateLeadStage: updateLeadStage.mutate,
    reorderLeads: reorderLeads.mutate,
    deleteLead: deleteLead.mutate,
    inactivateLead: inactivateLead.mutate,
    reactivateLead: reactivateLead.mutate,
    bulkDeleteLeads: bulkDeleteLeads.mutate,
    bulkInactivateLeads: bulkInactivateLeads.mutate,
    bulkMoveStage: bulkMoveStage.mutate,
    isCreating: createLead.isPending,
    isUpdating: updateLead.isPending,
    isDeleting: deleteLead.isPending || bulkDeleteLeads.isPending,
    isInactivating: inactivateLead.isPending || bulkInactivateLeads.isPending,
    isReactivating: reactivateLead.isPending,
  };
}

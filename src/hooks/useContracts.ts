import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables, TablesInsert, TablesUpdate, Enums } from '@/integrations/supabase/types';

export type Contract = Tables<'contracts'>;
export type ContractInsert = TablesInsert<'contracts'>;
export type ContractUpdate = TablesUpdate<'contracts'>;
export type ContractStatus = Enums<'contract_status'>;
export type ContractType = Enums<'contract_type'>;

export interface ContractWithDetails extends Contract {
  property: { id: string; title: string; address_city: string | null } | null;
  lead: { id: string; name: string; email: string | null; phone: string | null } | null;
  broker: { id: string; full_name: string } | null;
}

export interface ContractFormData {
  type: ContractType;
  property_id: string | null;
  lead_id: string | null;
  broker_id: string | null;
  value: number;
  commission_percentage: number | null;
  start_date: string | null;
  end_date: string | null;
  payment_day: number | null;
  readjustment_index: string | null;
  status: ContractStatus;
  notes: string | null;
}

export function useContracts() {
  const { toast } = useToast();
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: contracts = [], isLoading, error } = useQuery({
    queryKey: ['contracts', profile?.organization_id],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      // Buscar contratos
      // PERF: Select only columns used in listing
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('id, code, type, status, value, commission_percentage, start_date, end_date, payment_day, readjustment_index, notes, property_id, lead_id, broker_id, created_at, created_by, updated_at, organization_id')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });

      if (contractsError) throw contractsError;
      if (!contractsData) return [];

      // Coletar IDs para buscar relacionamentos
      const propertyIds = [...new Set(contractsData.filter(c => c.property_id).map(c => c.property_id!))];
      const leadIds = [...new Set(contractsData.filter(c => c.lead_id).map(c => c.lead_id!))];
      const brokerIds = [...new Set(contractsData.filter(c => c.broker_id).map(c => c.broker_id!))];

      // Buscar relacionamentos em paralelo
      const [propertiesResult, leadsResult, brokersResult] = await Promise.all([
        propertyIds.length > 0
          ? supabase.from('properties').select('id, title, address_city').in('id', propertyIds)
          : Promise.resolve({ data: [] }),
        leadIds.length > 0
          ? supabase.from('leads').select('id, name, email, phone').in('id', leadIds)
          : Promise.resolve({ data: [] }),
        brokerIds.length > 0
          ? supabase.from('profiles_public' as any).select('id, full_name').in('id', brokerIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Criar mapas para lookup rápido
      const propertiesMap = Object.fromEntries(
        (propertiesResult.data || []).map(p => [p.id, p])
      );
      const leadsMap = Object.fromEntries(
        (leadsResult.data || []).map(l => [l.id, l])
      );
      const brokersMap = Object.fromEntries(
        ((brokersResult.data as unknown) as { id: string; full_name: string }[] || []).map(b => [b.id, b])
      );

      // Combinar dados
      return contractsData.map(contract => ({
        ...contract,
        property: contract.property_id ? propertiesMap[contract.property_id] || null : null,
        lead: contract.lead_id ? leadsMap[contract.lead_id] || null : null,
        broker: contract.broker_id ? brokersMap[contract.broker_id] || null : null,
      })) as ContractWithDetails[];
    },
    enabled: !!profile?.organization_id,
  });

  const generateCode = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const startOfYear = `${year}-01-01`;
    
    const { count, error } = await supabase
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfYear);

    if (error) {
      console.error('Erro ao gerar código:', error);
      return `CONT-${year}-0001`;
    }

    return `CONT-${year}-${String((count || 0) + 1).padStart(4, '0')}`;
  };

  const createContract = useMutation({
    mutationFn: async (data: ContractFormData) => {
      if (!profile?.organization_id || !user?.id) {
        throw new Error('Organização não encontrada');
      }

      const code = await generateCode();

      const { data: result, error } = await supabase
        .from('contracts')
        .insert({
          ...data,
          code,
          organization_id: profile.organization_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({
        title: 'Contrato criado',
        description: 'O contrato foi criado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar contrato',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateContract = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContractFormData> }) => {
      const { data: result, error } = await supabase
        .from('contracts')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({
        title: 'Contrato atualizado',
        description: 'O contrato foi atualizado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar contrato',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteContract = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({
        title: 'Contrato removido',
        description: 'O contrato foi removido com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover contrato',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Estatísticas
  const stats = {
    total: contracts.length,
    rascunho: contracts.filter(c => c.status === 'rascunho').length,
    ativo: contracts.filter(c => c.status === 'ativo').length,
    encerrado: contracts.filter(c => c.status === 'encerrado').length,
    cancelado: contracts.filter(c => c.status === 'cancelado').length,
    valorTotal: contracts
      .filter(c => c.status === 'ativo')
      .reduce((sum, c) => sum + Number(c.value), 0),
  };

  return {
    contracts,
    isLoading,
    error,
    stats,
    generateCode,
    createContract: createContract.mutate,
    updateContract: updateContract.mutate,
    deleteContract: deleteContract.mutate,
    isCreating: createContract.isPending,
    isUpdating: updateContract.isPending,
    isDeleting: deleteContract.isPending,
  };
}

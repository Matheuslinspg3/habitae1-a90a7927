import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type Invoice = Tables<'invoices'> & {
  lead?: { id: string; name: string } | null;
  contract?: { id: string; code: string } | null;
};

export type InvoiceFormData = {
  description: string;
  amount: number;
  due_date: string;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  lead_id?: string | null;
  contract_id?: string | null;
  notes?: string | null;
  paid_at?: string | null;
};

export function useInvoices() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading, error } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          lead:leads(id, name),
          contract:contracts(id, code)
        `)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data as Invoice[];
    },
  });

  const createInvoice = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      if (!user || !profile?.organization_id) {
        throw new Error('Usuário não autenticado');
      }

      const { data: result, error } = await supabase
        .from('invoices')
        .insert({
          ...data,
          organization_id: profile.organization_id,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({
        title: 'Cobrança criada',
        description: 'A cobrança foi registrada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar cobrança',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, ...data }: InvoiceFormData & { id: string }) => {
      const { data: result, error } = await supabase
        .from('invoices')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({
        title: 'Cobrança atualizada',
        description: 'A cobrança foi atualizada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar cobrança',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Calculate pending amount
  const pendingAmount = invoices
    .filter((i) => i.status === 'pendente' || i.status === 'atrasado')
    .reduce((acc, i) => acc + Number(i.amount), 0);

  const pendingCount = invoices.filter((i) => i.status === 'pendente' || i.status === 'atrasado').length;

  return {
    invoices,
    isLoading,
    error,
    pendingAmount,
    pendingCount,
    createInvoice: createInvoice.mutate,
    updateInvoice: updateInvoice.mutate,
    isCreating: createInvoice.isPending,
    isUpdating: updateInvoice.isPending,
  };
}

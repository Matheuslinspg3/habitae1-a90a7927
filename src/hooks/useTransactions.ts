import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type Transaction = Tables<'transactions'> & {
  category?: { id: string; name: string } | null;
  contract?: { id: string; code: string } | null;
};

export type TransactionFormData = {
  type: 'receita' | 'despesa';
  description: string;
  amount: number;
  date: string;
  category_id?: string | null;
  contract_id?: string | null;
  paid?: boolean;
  paid_at?: string | null;
  notes?: string | null;
};

export function useTransactions() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading, error } = useQuery({
    queryKey: ['transactions', profile?.organization_id],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          category:transaction_categories(id, name),
          contract:contracts(id, code)
        `)
        .eq('organization_id', profile.organization_id)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!profile?.organization_id,
  });

  const createTransaction = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      if (!user || !profile?.organization_id) {
        throw new Error('Usuário não autenticado');
      }

      const { data: result, error } = await supabase
        .from('transactions')
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
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({
        title: 'Transação criada',
        description: 'A transação foi registrada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar transação',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...data }: TransactionFormData & { id: string }) => {
      const { data: result, error } = await supabase
        .from('transactions')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({
        title: 'Transação atualizada',
        description: 'A transação foi atualizada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar transação',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({
        title: 'Transação removida',
        description: 'A transação foi removida com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover transação',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Calculate summary stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const monthlyTransactions = transactions.filter((t) => {
    const date = new Date(t.date);
    return date >= startOfMonth && date <= endOfMonth;
  });

  const stats = {
    balance: transactions
      .filter((t) => t.paid)
      .reduce((acc, t) => acc + (t.type === 'receita' ? Number(t.amount) : -Number(t.amount)), 0),
    monthlyRevenue: monthlyTransactions
      .filter((t) => t.type === 'receita')
      .reduce((acc, t) => acc + Number(t.amount), 0),
    monthlyExpenses: monthlyTransactions
      .filter((t) => t.type === 'despesa')
      .reduce((acc, t) => acc + Number(t.amount), 0),
  };

  // Get last N months data for chart (max 12) - memoized
  const chartData = useMemo(() => {
    const monthCount = 12;
    const months = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthTransactions = transactions.filter((t) => {
        const tDate = new Date(t.date);
        return tDate >= monthStart && tDate <= monthEnd;
      });

      months.push({
        month: date.toLocaleDateString('pt-BR', { month: 'short' }),
        receitas: monthTransactions
          .filter((t) => t.type === 'receita')
          .reduce((acc, t) => acc + Number(t.amount), 0),
        despesas: monthTransactions
          .filter((t) => t.type === 'despesa')
          .reduce((acc, t) => acc + Number(t.amount), 0),
      });
    }
    return months;
  }, [transactions]);

  return {
    transactions,
    isLoading,
    error,
    stats,
    chartData,
    createTransaction: createTransaction.mutate,
    updateTransaction: updateTransaction.mutate,
    deleteTransaction: deleteTransaction.mutate,
    isCreating: createTransaction.isPending,
    isUpdating: updateTransaction.isPending,
    isDeleting: deleteTransaction.isPending,
  };
}

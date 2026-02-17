import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type TransactionCategory = Tables<'transaction_categories'>;

export function useTransactionCategories() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading, error } = useQuery({
    queryKey: ['transaction-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_categories')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      return data as TransactionCategory[];
    },
  });

  const createCategory = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: 'receita' | 'despesa' }) => {
      if (!profile?.organization_id) {
        throw new Error('Organização não encontrada');
      }

      const { data, error } = await supabase
        .from('transaction_categories')
        .insert({
          name,
          type,
          is_default: false,
          organization_id: profile.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-categories'] });
      toast({
        title: 'Categoria criada',
        description: 'A categoria foi criada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar categoria',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const revenueCategories = categories.filter((c) => c.type === 'receita');
  const expenseCategories = categories.filter((c) => c.type === 'despesa');

  return {
    categories,
    revenueCategories,
    expenseCategories,
    isLoading,
    error,
    createCategory: createCategory.mutate,
    isCreating: createCategory.isPending,
  };
}

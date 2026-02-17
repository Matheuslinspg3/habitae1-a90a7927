import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type PropertyType = Tables<'property_types'>;

export function usePropertyTypes() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: propertyTypes = [], isLoading, error } = useQuery({
    queryKey: ['property-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_types')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;
      return data as PropertyType[];
    },
  });

  const createPropertyType = useMutation({
    mutationFn: async (name: string) => {
      if (!profile?.organization_id) {
        throw new Error('Organização não encontrada');
      }
      const { data, error } = await supabase
        .from('property_types')
        .insert({ name, is_default: false, organization_id: profile.organization_id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-types'] });
      toast({
        title: 'Tipo criado',
        description: 'O tipo de imóvel foi criado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar tipo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deletePropertyType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('property_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-types'] });
      toast({
        title: 'Tipo removido',
        description: 'O tipo de imóvel foi removido com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover tipo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    propertyTypes,
    isLoading,
    error,
    createPropertyType: createPropertyType.mutate,
    deletePropertyType: deletePropertyType.mutate,
    isCreating: createPropertyType.isPending,
    isDeleting: deletePropertyType.isPending,
  };
}

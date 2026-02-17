import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDemo } from '@/contexts/DemoContext';
import type { Tables } from '@/integrations/supabase/types';

export type Task = Tables<'tasks'> & {
  lead?: { id: string; name: string } | null;
};

export type TaskFormData = {
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: string;
  lead_id?: string | null;
  assigned_to?: string | null;
};

export function useTasks() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { isDemoMode, demoData } = useDemo();
  const queryClient = useQueryClient();

  // Demo mode: return mock data
  if (isDemoMode) {
    const demoTasks = demoData.tasks as unknown as Task[];
    const pendingTasks = demoTasks.filter((t) => !t.completed);
    const completedTasks = demoTasks.filter((t) => t.completed);
    
    const demoMutate = () => {
      toast({
        title: 'Modo Demonstração',
        description: 'Os dados não serão salvos neste modo.',
      });
    };

    return {
      tasks: demoTasks,
      pendingTasks,
      completedTasks,
      isLoading: false,
      error: null,
      createTask: demoMutate,
      updateTask: demoMutate,
      toggleComplete: demoMutate,
      deleteTask: demoMutate,
      isCreating: false,
      isUpdating: false,
      isDeleting: false,
    };
  }

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          lead:leads(id, name)
        `)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Task[];
    },
  });

  const createTask = useMutation({
    mutationFn: async (data: TaskFormData) => {
      if (!user || !profile?.organization_id) {
        throw new Error('Usuário não autenticado');
      }

      const { data: result, error } = await supabase
        .from('tasks')
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
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: 'Tarefa criada',
        description: 'A tarefa foi criada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar tarefa',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...data }: TaskFormData & { id: string }) => {
      const { data: result, error } = await supabase
        .from('tasks')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: 'Tarefa atualizada',
        description: 'A tarefa foi atualizada com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar tarefa',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from('tasks')
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: variables.completed ? 'Tarefa concluída' : 'Tarefa reaberta',
        description: variables.completed
          ? 'A tarefa foi marcada como concluída.'
          : 'A tarefa foi reaberta.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar tarefa',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: 'Tarefa removida',
        description: 'A tarefa foi removida com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover tarefa',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  return {
    tasks,
    pendingTasks,
    completedTasks,
    isLoading,
    error,
    createTask: createTask.mutate,
    updateTask: updateTask.mutate,
    toggleComplete: toggleComplete.mutate,
    deleteTask: deleteTask.mutate,
    isCreating: createTask.isPending,
    isUpdating: updateTask.isPending,
    isDeleting: deleteTask.isPending,
  };
}

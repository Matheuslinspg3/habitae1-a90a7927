import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export type Appointment = Tables<'appointments'> & {
  lead?: { id: string; name: string } | null;
  property?: { id: string; title: string } | null;
};

export type AppointmentFormData = {
  title: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  description?: string | null;
  lead_id?: string | null;
  property_id?: string | null;
  assigned_to?: string | null;
};

export function useAppointments() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: appointments = [], isLoading, error } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          lead:leads(id, name),
          property:properties(id, title)
        `)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data as Appointment[];
    },
  });

  const createAppointment = useMutation({
    mutationFn: async (data: AppointmentFormData) => {
      if (!user || !profile?.organization_id) {
        throw new Error('Usuário não autenticado');
      }

      const { data: result, error } = await supabase
        .from('appointments')
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
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({
        title: 'Compromisso criado',
        description: 'O compromisso foi agendado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar compromisso',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateAppointment = useMutation({
    mutationFn: async ({ id, ...data }: AppointmentFormData & { id: string }) => {
      const { data: result, error } = await supabase
        .from('appointments')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({
        title: 'Compromisso atualizado',
        description: 'O compromisso foi atualizado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar compromisso',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ completed })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({
        title: 'Compromisso removido',
        description: 'O compromisso foi removido com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover compromisso',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Get today's appointments
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayAppointments = appointments.filter((a) => {
    const startTime = new Date(a.start_time);
    return startTime >= today && startTime < tomorrow;
  });

  // Get appointments for a specific date
  const getAppointmentsByDate = (date: Date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    return appointments.filter((a) => {
      const startTime = new Date(a.start_time);
      return startTime >= dayStart && startTime < dayEnd;
    });
  };

  // Get dates with appointments for calendar highlighting
  const datesWithAppointments = [...new Set(
    appointments.map((a) => {
      const date = new Date(a.start_time);
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    })
  )];

  return {
    appointments,
    todayAppointments,
    datesWithAppointments,
    getAppointmentsByDate,
    isLoading,
    error,
    createAppointment: createAppointment.mutate,
    updateAppointment: updateAppointment.mutate,
    toggleComplete: toggleComplete.mutate,
    deleteAppointment: deleteAppointment.mutate,
    isCreating: createAppointment.isPending,
    isUpdating: updateAppointment.isPending,
    isDeleting: deleteAppointment.isPending,
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { registerLeadScoreEvent } from "@/lib/leadScore";
import type { Tables, Enums } from "@/integrations/supabase/types";

export type VisitStatus = Enums<"visit_status">;

export type PropertyVisit = Tables<"property_visits"> & {
  property?: { id: string; title: string; address_neighborhood: string | null; address_city: string | null } | null;
  lead?: { id: string; name: string } | null;
  agent?: { user_id: string; full_name: string; avatar_url: string | null } | null;
};

export interface VisitFilters {
  dateStart?: string;
  dateEnd?: string;
  agentId?: string;
  visitStatus?: VisitStatus;
  propertyId?: string;
  leadId?: string;
}

export interface CreateVisitInput {
  property_id: string;
  lead_id: string;
  agent_id: string;
  scheduled_at: string;
  notes?: string;
}

export function useVisits(filters?: VisitFilters) {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["property_visits", filters],
    staleTime: 2 * 60_000, // PERF: 2min stale for visits
    queryFn: async () => {
      let query = supabase
        .from("property_visits")
        .select(`
          *,
          property:properties(id, title, address_neighborhood, address_city),
          lead:leads(id, name),
          agent:profiles!property_visits_agent_id_fkey(user_id, full_name, avatar_url)
        `)
        .order("scheduled_at", { ascending: true });

      if (filters?.dateStart) query = query.gte("scheduled_at", filters.dateStart);
      if (filters?.dateEnd) query = query.lt("scheduled_at", filters.dateEnd);
      if (filters?.agentId) query = query.eq("agent_id", filters.agentId);
      if (filters?.visitStatus) query = query.eq("visit_status", filters.visitStatus);
      if (filters?.propertyId) query = query.eq("property_id", filters.propertyId);
      if (filters?.leadId) query = query.eq("lead_id", filters.leadId);

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as PropertyVisit[];
    },
    enabled: !!user,
  });

  const createVisit = useMutation({
    mutationFn: async (input: CreateVisitInput) => {
      if (!user || !profile?.organization_id) throw new Error("Não autenticado");

      // 1. Insert visit
      const { data, error } = await supabase
        .from("property_visits")
        .insert({
          organization_id: profile.organization_id,
          property_id: input.property_id,
          lead_id: input.lead_id,
          agent_id: input.agent_id,
          scheduled_at: input.scheduled_at,
          notes: input.notes || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Create lead interaction
      await supabase.from("lead_interactions").insert({
        lead_id: input.lead_id,
        created_by: user.id,
        type: "visita" as any,
        description: `Visita agendada para ${new Date(input.scheduled_at).toLocaleDateString("pt-BR")}`,
        occurred_at: new Date().toISOString(),
      });

      // 3. Register score event
      await registerLeadScoreEvent(input.lead_id, "visit_scheduled", {
        property_id: input.property_id,
        visit_id: data.id,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property_visits"] });
      queryClient.invalidateQueries({ queryKey: ["lead-interactions"] });
      queryClient.invalidateQueries({ queryKey: ["lead_score_events"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast({ title: "Visita agendada com sucesso" });
    },
    onError: (error) => {
      toast({ title: "Erro ao agendar visita", description: error.message, variant: "destructive" });
    },
  });

  const updateVisitStatus = useMutation({
    mutationFn: async ({
      visitId,
      status,
      leadId,
      feedback,
      rating,
      cancelledReason,
    }: {
      visitId: string;
      status: VisitStatus;
      leadId: string;
      feedback?: string;
      rating?: number;
      cancelledReason?: string;
    }) => {
      const updateData: Record<string, any> = { visit_status: status };
      if (status === "completed") {
        updateData.completed_at = new Date().toISOString();
        if (feedback) updateData.feedback = feedback;
        if (rating) updateData.rating = rating;
      }
      if (status === "cancelled" && cancelledReason) {
        updateData.cancelled_reason = cancelledReason;
      }

      const { error } = await supabase
        .from("property_visits")
        .update(updateData)
        .eq("id", visitId);

      if (error) throw error;

      // Score events
      if (status === "completed") {
        await registerLeadScoreEvent(leadId, "visit_completed", { visit_id: visitId });
      } else if (status === "no_show") {
        await registerLeadScoreEvent(leadId, "missed_visit", { visit_id: visitId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property_visits"] });
      queryClient.invalidateQueries({ queryKey: ["lead_score_events"] });
      toast({ title: "Visita atualizada" });
    },
    onError: (error) => {
      toast({ title: "Erro ao atualizar visita", description: error.message, variant: "destructive" });
    },
  });

  return {
    visits,
    isLoading,
    createVisit: createVisit.mutate,
    isCreating: createVisit.isPending,
    updateVisitStatus: updateVisitStatus.mutate,
    isUpdating: updateVisitStatus.isPending,
  };
}

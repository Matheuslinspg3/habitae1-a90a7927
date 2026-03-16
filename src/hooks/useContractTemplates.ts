import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface ContractTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  contract_type: string;
  body_html: string;
  variables: string[];
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContractTemplateFormData {
  name: string;
  description?: string | null;
  contract_type: string;
  body_html: string;
  variables: string[];
  is_default?: boolean;
}

export function useContractTemplates() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["contract-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ContractTemplate[];
    },
    enabled: !!profile?.organization_id,
  });

  const createTemplate = useMutation({
    mutationFn: async (formData: ContractTemplateFormData) => {
      if (!profile?.organization_id || !user?.id) throw new Error("Organização não encontrada");
      const { error } = await supabase.from("contract_templates").insert({
        organization_id: profile.organization_id,
        created_by: user.id,
        ...formData,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-templates"] });
      toast({ title: "Template criado com sucesso" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar template", description: err.message, variant: "destructive" });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContractTemplateFormData> }) => {
      const { error } = await supabase.from("contract_templates").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-templates"] });
      toast({ title: "Template atualizado" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contract_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract-templates"] });
      toast({ title: "Template excluído" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  return {
    templates,
    isLoading,
    createTemplate: createTemplate.mutate,
    updateTemplate: updateTemplate.mutate,
    deleteTemplate: deleteTemplate.mutate,
    isCreating: createTemplate.isPending,
    isUpdating: updateTemplate.isPending,
  };
}

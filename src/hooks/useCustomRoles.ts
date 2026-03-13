import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const MODULE_LIST = [
  { key: "properties", label: "Imóveis", icon: "Home" },
  { key: "owners", label: "Proprietários", icon: "UserCog" },
  { key: "crm", label: "CRM", icon: "Users" },
  { key: "contracts", label: "Contratos", icon: "FileText" },
  { key: "financial", label: "Financeiro", icon: "DollarSign" },
  { key: "schedule", label: "Agenda", icon: "Calendar" },
  { key: "marketplace", label: "Marketplace", icon: "Store" },
  { key: "ads", label: "Anúncios", icon: "Megaphone" },
  { key: "integrations", label: "Integrações", icon: "Plug" },
  { key: "activities", label: "Atividades", icon: "BarChart3" },
] as const;

export type ModuleKey = typeof MODULE_LIST[number]["key"];

export interface CustomRole {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  base_role: string;
  module_permissions: Record<ModuleKey, boolean>;
  created_at: string;
  updated_at: string;
}

export function useCustomRoles() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["custom-roles", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("organization_custom_roles")
        .select("*")
        .eq("organization_id", orgId)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as CustomRole[];
    },
    enabled: !!orgId,
  });
}

export function useUpsertCustomRole() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (role: Partial<CustomRole> & { name: string; module_permissions: Record<string, boolean> }) => {
      if (!profile?.organization_id) throw new Error("No org");
      const payload = {
        ...role,
        organization_id: profile.organization_id,
        updated_at: new Date().toISOString(),
      };

      if (role.id) {
        const { error } = await supabase
          .from("organization_custom_roles")
          .update(payload as any)
          .eq("id", role.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("organization_custom_roles")
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      toast.success("Cargo salvo com sucesso");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCustomRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("organization_custom_roles")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-roles"] });
      toast.success("Cargo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

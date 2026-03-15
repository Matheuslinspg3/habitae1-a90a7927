import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const safeText = (value: unknown) => String(value ?? "").trim();

const throwDetailedFunctionError = async (error: any): Promise<never> => {
  const fallback = safeText(error?.message) || "Erro na função de WhatsApp";

  try {
    const response = error?.context;
    if (!response?.clone) throw new Error("no response context");

    try {
      const json = await response.clone().json();
      const detailed = safeText(json?.error || json?.message || JSON.stringify(json));
      throw new Error(detailed || fallback);
    } catch {
      const text = await response.clone().text();
      throw new Error(safeText(text) || fallback);
    }
  } catch {
    throw new Error(fallback);
  }
};

export function useWhatsAppInstance() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: instance, isLoading } = useQuery({
    queryKey: ["whatsapp-instance", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("whatsapp_instances" as any)
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!orgId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const orgName = profile?.organization_id
        ? await supabase.from("organizations").select("name").eq("id", profile.organization_id).single().then((r) => r.data?.name || "org")
        : "org";
      const userName = profile?.full_name || "user";
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "create", orgName, userName },
      });
      if (error) await throwDetailedFunctionError(error);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Instância WhatsApp criada com sucesso!");
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar instância");
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "connect" },
      });
      if (error) await throwDetailedFunctionError(error);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.info("QR Code gerado. Escaneie com o WhatsApp.");
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao conectar");
    },
  });

  const statusMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "status" },
      });
      if (error) await throwDetailedFunctionError(error);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data?.status === "connected") {
        toast.success("WhatsApp conectado!");
      } else {
        toast.info(`Status: ${data?.status || "desconhecido"}`);
      }
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao verificar status");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "disconnect" },
      });
      if (error) await throwDetailedFunctionError(error);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("WhatsApp desconectado");
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao desconectar");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "delete" },
      });
      if (error) await throwDetailedFunctionError(error);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Instância WhatsApp removida");
      invalidate();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao remover instância");
    },
  });

  return {
    instance,
    isLoading,
    createInstance: () => createMutation.mutateAsync(),
    connectInstance: () => connectMutation.mutateAsync(),
    checkStatus: () => statusMutation.mutateAsync(),
    disconnectInstance: () => disconnectMutation.mutateAsync(),
    deleteInstance: () => deleteMutation.mutateAsync(),
    isCreating: createMutation.isPending,
    isConnecting: connectMutation.isPending,
    isCheckingStatus: statusMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MaintenanceConfig {
  maintenance_mode: boolean;
  maintenance_message: string;
  maintenance_started_at: string | null;
  maintenance_started_by: string | null;
  updated_at: string;
}

export function useMaintenanceMode() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["maintenance-mode"],
    queryFn: async (): Promise<MaintenanceConfig> => {
      const { data, error } = await supabase
        .from("app_runtime_config")
        .select("*")
        .eq("id", "singleton")
        .single();

      if (error) throw error;
      return data as MaintenanceConfig;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    retry: 1,
  });

  // Fail-secure: if query fails, assume maintenance is active
  const isMaintenanceMode = error ? true : (data?.maintenance_mode ?? false);
  const maintenanceMessage = data?.maintenance_message ?? "Estamos em manutenção. Tente novamente em alguns minutos.";

  return {
    isMaintenanceMode,
    maintenanceMessage,
    maintenanceStartedAt: data?.maintenance_started_at ?? null,
    maintenanceStartedBy: data?.maintenance_started_by ?? null,
    isLoading,
    error,
    refetch,
  };
}

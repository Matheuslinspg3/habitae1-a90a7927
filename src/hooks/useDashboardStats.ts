import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DashboardStats {
  active_properties: number;
  total_properties: number;
  active_leads: number;
  new_leads_week: number;
  active_contracts: number;
  pending_contracts: number;
  monthly_revenue: number;
  balance: number;
}

const EMPTY_STATS: DashboardStats = {
  active_properties: 0,
  total_properties: 0,
  active_leads: 0,
  new_leads_week: 0,
  active_contracts: 0,
  pending_contracts: 0,
  monthly_revenue: 0,
  balance: 0,
};

export function useDashboardStats() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["dashboard_stats", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return EMPTY_STATS;
      const { data, error } = await supabase.rpc("fn_dashboard_stats", {
        p_org_id: profile.organization_id,
      });
      if (error) throw error;
      return (data as unknown as DashboardStats) || EMPTY_STATS;
    },
    enabled: !!profile?.organization_id,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

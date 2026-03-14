import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface FunnelStage {
  stage_id: string;
  name: string;
  color: string;
  position: number;
  is_win: boolean;
  is_loss: boolean;
  count: number;
}

export function useDashboardFunnel(dateRange: { from: Date; to: Date }) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["funnel_detail", profile?.organization_id, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase.rpc("fn_funnel_detail", {
        p_org_id: profile.organization_id,
        p_start: dateRange.from.toISOString(),
        p_end: dateRange.to.toISOString(),
      });
      if (error) throw error;
      return (data as unknown as FunnelStage[]) || [];
    },
    enabled: !!profile?.organization_id,
    staleTime: 60_000,
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AgentRank {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  active_leads: number;
  visits: number;
  closings: number;
  interactions: number;
  avg_response_hours: number | null;
}

export function useDashboardRanking(dateRange: { from: Date; to: Date }) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["agent_ranking", profile?.organization_id, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase.rpc("fn_agent_ranking", {
        p_org_id: profile.organization_id,
        p_start: dateRange.from.toISOString(),
        p_end: dateRange.to.toISOString(),
      });
      if (error) throw error;
      return (data as unknown as AgentRank[]) || [];
    },
    enabled: !!profile?.organization_id,
    staleTime: 60_000,
  });
}

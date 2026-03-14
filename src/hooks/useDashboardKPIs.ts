import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface KPIData {
  leads: number;
  visits: number;
  proposals: number;
  closings: number;
  conversion_rate: number;
  avg_ticket: number;
  prev_leads: number;
  prev_visits: number;
  prev_proposals: number;
  prev_closings: number;
  prev_conversion_rate: number;
  prev_avg_ticket: number;
}

function pctChange(current: number, previous: number): { value: string; positive: boolean } | undefined {
  if (previous === 0 && current === 0) return undefined;
  if (previous === 0) return { value: "Novo", positive: true };
  const pct = ((current - previous) / previous) * 100;
  return { value: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`, positive: pct >= 0 };
}

export function useDashboardKPIs(dateRange: { from: Date; to: Date }) {
  const { profile } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["kpi_metrics", profile?.organization_id, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      const { data, error } = await supabase.rpc("fn_kpi_metrics", {
        p_org_id: profile.organization_id,
        p_start: dateRange.from.toISOString(),
        p_end: dateRange.to.toISOString(),
      });
      if (error) throw error;
      return data as unknown as KPIData;
    },
    enabled: !!profile?.organization_id,
    staleTime: 60_000,
  });

  const kpis = data
    ? {
        leads: { value: data.leads, trend: pctChange(data.leads, data.prev_leads) },
        visits: { value: data.visits, trend: pctChange(data.visits, data.prev_visits) },
        proposals: { value: data.proposals, trend: pctChange(data.proposals, data.prev_proposals) },
        closings: { value: data.closings, trend: pctChange(data.closings, data.prev_closings) },
        conversionRate: { value: `${data.conversion_rate}%`, trend: pctChange(data.conversion_rate, data.prev_conversion_rate) },
        avgTicket: { value: data.avg_ticket, trend: pctChange(data.avg_ticket, data.prev_avg_ticket) },
      }
    : null;

  return { kpis, isLoading };
}

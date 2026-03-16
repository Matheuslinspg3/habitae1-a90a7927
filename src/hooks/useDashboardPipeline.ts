// PERF: Single RPC replaces 4x useLeads() calls in dashboard components
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDemo } from '@/contexts/DemoContext';

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  position: number;
  is_win: boolean;
  is_loss: boolean;
  count: number;
  total_value: number;
}

export interface InactiveLead {
  id: string;
  name: string;
  days_inactive: number;
}

export interface PipelineSummary {
  stages: PipelineStage[];
  inactive_leads: InactiveLead[];
  total_active: number;
  total_won: number;
  overall_rate: number;
}

export function useDashboardPipeline() {
  const { profile } = useAuth();
  const { isDemoMode } = useDemo();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-pipeline', profile?.organization_id],
    staleTime: 2 * 60_000, // PERF: 2min stale — dashboard data doesn't need real-time freshness
    queryFn: async (): Promise<PipelineSummary> => {
      if (!profile?.organization_id) {
        return { stages: [], inactive_leads: [], total_active: 0, total_won: 0, overall_rate: 0 };
      }

      const { data, error } = await supabase.rpc('fn_pipeline_summary', {
        p_org_id: profile.organization_id,
      });

      if (error) throw error;
      return data as unknown as PipelineSummary;
    },
    enabled: !!profile?.organization_id && !isDemoMode,
  });

  return {
    stages: data?.stages ?? [],
    inactiveLeads: data?.inactive_leads ?? [],
    totalActive: data?.total_active ?? 0,
    totalWon: data?.total_won ?? 0,
    overallRate: data?.overall_rate ?? 0,
    isLoading: isLoading && !isDemoMode,
  };
}

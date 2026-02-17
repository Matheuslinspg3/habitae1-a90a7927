import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AdminMetrics {
  counts?: {
    properties: number;
    properties_active: number;
    leads: number;
    leads_active: number;
    organizations: number;
    profiles: number;
    property_images: number;
    contracts: number;
    tasks: number;
    appointments: number;
  };
  propertiesByStatus?: Array<{ status: string; count: number }>;
  organizations?: Array<{
    id: string;
    name: string;
    type: string;
    created_at: string;
    total_properties: number;
    active_properties: number;
    total_leads: number;
    active_leads: number;
    total_users: number;
    total_images: number;
  }>;
  growth?: {
    properties_7d: number;
    properties_30d: number;
    leads_7d: number;
    leads_30d: number;
    orgs_7d: number;
    orgs_30d: number;
    users_7d: number;
    users_30d: number;
  };
  health?: {
    properties_without_type: number;
    properties_without_price: number;
    leads_without_broker: number;
    orphan_images: number;
    marketplace_access_7d: number;
    contracts_active: number;
    invoices_pending: number;
  };
  tableSizes?: Array<{
    table_name: string;
    total_size: string;
    size_bytes: number;
    row_count: number;
  }>;

  functionTelemetry?: {
    summaryByFunction?: Array<{
      functionName: string;
      totalCalls24h: number;
      blockedCalls24h: number;
      blockRate: number;
      avgDurationMs: number;
    }>;
    recentBlockedEvents?: Array<{
      function_name: string;
      organization_id: string | null;
      user_id: string | null;
      allowed: boolean;
      reason: string | null;
      response_status: number | null;
      duration_ms: number | null;
      created_at: string;
    }>;
    activeBlocks?: Array<{
      function_name: string;
      organization_id: string | null;
      user_id: string | null;
      reason: string;
      blocked_until: string;
    }>;
    error?: string;
  };

  cloudinary?: {
    storage?: {
      used: number;
      limit: number;
      usedFormatted: string;
      limitFormatted: string;
      percentage: number;
    };
    bandwidth?: {
      used: number;
      limit: number;
      usedFormatted: string;
      limitFormatted: string;
      percentage: number;
    };
    transformations?: {
      used: number;
      limit: number;
      percentage: number;
    };
    credits?: number;
    plan?: string;
    error?: string;
  };
  timestamp?: string;
  generatedBy?: string;
}

export function useAdminMetrics() {
  const { user, session } = useAuth();

  return useQuery<AdminMetrics>({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const { data, error } = await supabase.functions.invoke('admin-audit-metrics', {
        body: {},
      });

      if (error) {
        throw new Error(error.message || 'Erro ao buscar métricas');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data as AdminMetrics;
    },
    enabled: !!user && !!session,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

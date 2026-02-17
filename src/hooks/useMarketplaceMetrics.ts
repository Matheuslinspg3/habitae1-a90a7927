import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MarketplaceMetric {
  property_id: string;
  title: string;
  contact_count: number;
  last_contact_at: string | null;
}

export function useMarketplaceMetrics() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["marketplace-metrics", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Get published properties
      const { data: published, error: pubErr } = await supabase
        .from("marketplace_properties")
        .select("id, title")
        .eq("organization_id", profile.organization_id);

      if (pubErr) throw pubErr;
      if (!published?.length) return [];

      // Get contact access counts
      const { data: contacts, error: contactErr } = await supabase
        .from("marketplace_contact_access")
        .select("marketplace_property_id, accessed_at")
        .in("marketplace_property_id", published.map((p) => p.id));

      if (contactErr) throw contactErr;

      // Aggregate
      const countMap = new Map<string, { count: number; lastAt: string | null }>();
      (contacts || []).forEach((c) => {
        const existing = countMap.get(c.marketplace_property_id);
        if (existing) {
          existing.count++;
          if (!existing.lastAt || c.accessed_at > existing.lastAt) {
            existing.lastAt = c.accessed_at;
          }
        } else {
          countMap.set(c.marketplace_property_id, { count: 1, lastAt: c.accessed_at });
        }
      });

      return published.map((p) => ({
        property_id: p.id,
        title: p.title,
        contact_count: countMap.get(p.id)?.count || 0,
        last_contact_at: countMap.get(p.id)?.lastAt || null,
      })) as MarketplaceMetric[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 60_000,
  });
}

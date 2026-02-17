import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a Set of property IDs that are published in the marketplace.
 */
export function useMarketplaceStatus() {
  const { data: publishedIds = new Set<string>(), isLoading } = useQuery({
    queryKey: ["marketplace-published-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_properties")
        .select("id");

      if (error) throw error;
      return new Set((data || []).map((d) => d.id));
    },
    staleTime: 30_000,
  });

  return { publishedIds, isLoading };
}

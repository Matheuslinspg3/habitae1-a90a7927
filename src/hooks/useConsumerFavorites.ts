import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useConsumerFavorites(userId?: string) {
  const queryClient = useQueryClient();

  const favoritesQuery = useQuery({
    queryKey: ["consumer-favorites", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consumer_favorites")
        .select("property_id")
        .eq("user_id", userId!);
      if (error) throw error;
      return new Set((data || []).map((f) => f.property_id));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      if (!userId) throw new Error("Not authenticated");
      const current = favoritesQuery.data;
      if (current?.has(propertyId)) {
        const { error } = await supabase
          .from("consumer_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("property_id", propertyId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("consumer_favorites")
          .insert({ user_id: userId, property_id: propertyId });
        if (error) throw error;
      }
    },
    onMutate: async (propertyId) => {
      await queryClient.cancelQueries({ queryKey: ["consumer-favorites", userId] });
      const prev = queryClient.getQueryData<Set<string>>(["consumer-favorites", userId]);
      const next = new Set(prev);
      if (next.has(propertyId)) next.delete(propertyId);
      else next.add(propertyId);
      queryClient.setQueryData(["consumer-favorites", userId], next);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["consumer-favorites", userId], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["consumer-favorites", userId] });
    },
  });

  return {
    favorites: favoritesQuery.data || new Set<string>(),
    isLoading: favoritesQuery.isLoading,
    toggleFavorite: toggleMutation.mutate,
  };
}

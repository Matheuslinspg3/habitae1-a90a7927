import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface LandingOverrides {
  id: string;
  property_id: string;
  organization_id: string;
  custom_headline: string | null;
  custom_subheadline: string | null;
  custom_description: string | null;
  custom_cta_primary: string | null;
  custom_cta_secondary: string | null;
  custom_key_features: any[] | null;
  hide_exact_address: boolean;
  show_nearby_pois: boolean;
  map_radius_meters: number;
  custom_sections: any | null;
}

export function useLandingOverrides(propertyId: string | undefined) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: overrides, isLoading } = useQuery({
    queryKey: ["landing-overrides", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_landing_overrides")
        .select("*")
        .eq("property_id", propertyId!)
        .maybeSingle();

      if (error) throw error;
      return data as LandingOverrides | null;
    },
    enabled: !!propertyId,
  });

  const saveOverrides = useMutation({
    mutationFn: async (updates: Partial<LandingOverrides>) => {
      if (!propertyId || !profile?.organization_id) throw new Error("Missing context");

      const payload = {
        ...updates,
        property_id: propertyId,
        organization_id: profile.organization_id,
      };

      if (overrides?.id) {
        const { error } = await supabase
          .from("property_landing_overrides")
          .update(payload)
          .eq("id", overrides.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("property_landing_overrides")
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-overrides", propertyId] });
    },
  });

  return {
    overrides,
    isLoading,
    saveOverrides: saveOverrides.mutate,
    isSaving: saveOverrides.isPending,
  };
}

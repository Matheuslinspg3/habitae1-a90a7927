import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PropertyOwner {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
}

export function usePropertyOwners() {
  const { profile } = useAuth();

  const { data: owners = [], isLoading } = useQuery({
    queryKey: ["property-owners", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Search from centralized owners table
      const { data, error } = await supabase
        .from("owners")
        .select("id, primary_name, phone, email, document")
        .eq("organization_id", profile.organization_id)
        .order("primary_name");

      if (error) throw error;

      return (data || []).map((owner) => ({
        id: owner.id,
        name: owner.primary_name,
        phone: owner.phone,
        email: owner.email,
        document: owner.document,
      }));
    },
    enabled: !!profile?.organization_id,
  });

  return { owners, isLoading };
}

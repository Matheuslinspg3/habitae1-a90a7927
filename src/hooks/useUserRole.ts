import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "sub_admin" | "corretor" | "assistente" | "developer" | "leader";

export function useUserRoles() {
  const { user } = useAuth();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []).map((r: { role: string }) => r.role as AppRole);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const hasRole = (role: AppRole) => roles.includes(role);
  const isDeveloper = hasRole("developer");
  const isLeader = hasRole("leader");
  const isAdmin = hasRole("admin");
  const isSubAdmin = hasRole("sub_admin");
  const isAdminOrAbove = isAdmin || isSubAdmin || isLeader || isDeveloper;
  const isDeveloperOrLeader = isDeveloper || isLeader;

  return { roles, isLoading, hasRole, isDeveloper, isLeader, isAdmin, isSubAdmin, isAdminOrAbove, isDeveloperOrLeader };
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "sub_admin" | "corretor" | "assistente" | "developer" | "leader";

export function useUserRoles() {
  const { user, session, profile } = useAuth();

  const sessionOrgId =
    (session?.user?.app_metadata?.active_organization_id as string | undefined) ||
    (session?.user?.user_metadata?.active_organization_id as string | undefined) ||
    (session?.user?.user_metadata?.organization_id as string | undefined);

  const activeOrganizationId = sessionOrgId || profile?.organization_id || null;

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["user-roles", user?.id, activeOrganizationId],
    queryFn: async () => {
      if (!user?.id || !activeOrganizationId) return [];

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("organization_id", activeOrganizationId);
      if (error) throw error;
      return (data || []).map((r: { role: string }) => r.role as AppRole);
    },
    enabled: !!user?.id && !!activeOrganizationId,
    staleTime: 5 * 60 * 1000,
  });

  const hasRole = (role: AppRole) => roles.includes(role);
  const isDeveloper = hasRole("developer");
  const isLeader = hasRole("leader");
  const isAdmin = hasRole("admin");
  const isSubAdmin = hasRole("sub_admin");
  const isAdminOrAbove = isAdmin || isSubAdmin || isLeader || isDeveloper;
  const isDeveloperOrLeader = isDeveloper || isLeader;

  return {
    roles,
    activeOrganizationId,
    isLoading,
    hasRole,
    isDeveloper,
    isLeader,
    isAdmin,
    isSubAdmin,
    isAdminOrAbove,
    isDeveloperOrLeader,
  };
}

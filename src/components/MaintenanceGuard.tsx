import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { useAuth } from "@/contexts/AuthContext";
import { useDemo } from "@/contexts/DemoContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// Public routes that should never be redirected
const PUBLIC_ROUTES = ["/manutencao", "/privacidade", "/instalar"];
// Routes that start with these prefixes are public app consumer routes
const PUBLIC_PREFIXES = ["/app/", "/i/", "/imovel/"];

function useIsSystemAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-system-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc("is_system_admin");
      if (error) return false;
      return data === true;
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function MaintenanceGuard({ children }: { children: ReactNode }) {
  const { isMaintenanceMode, isLoading: maintenanceLoading } = useMaintenanceMode();
  const { user, loading: authLoading } = useAuth();
  const { isDemoMode } = useDemo();
  const { data: isAdmin, isLoading: adminLoading } = useIsSystemAdmin();
  const navigate = useNavigate();
  const location = useLocation();

  const isPublicRoute =
    PUBLIC_ROUTES.includes(location.pathname) ||
    PUBLIC_PREFIXES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (maintenanceLoading || authLoading) return;
    if (!isMaintenanceMode) return;
    if (isDemoMode) return;
    if (isPublicRoute) return;
    if (location.pathname === "/manutencao") return;

    // If user is logged in, wait for admin check
    if (user && adminLoading) return;

    // Admin bypass
    if (user && isAdmin) return;

    // Non-admin user during maintenance → redirect
    navigate("/manutencao", { replace: true });
  }, [isMaintenanceMode, maintenanceLoading, authLoading, user, isAdmin, adminLoading, isDemoMode, isPublicRoute, location.pathname, navigate]);

  // Show brief loader while checking maintenance status (only on initial load)
  if (maintenanceLoading && !isPublicRoute) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}

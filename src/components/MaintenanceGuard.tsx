import { ReactNode, useEffect, useRef } from "react";
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

export function MaintenanceGuard({ children }: { children: ReactNode }) {
  const { isMaintenanceMode, isLoading: maintenanceLoading, forceLogoutAt } = useMaintenanceMode();
  const { user, loading: authLoading, session } = useAuth();
  const { isDemoMode } = useDemo();
  const navigate = useNavigate();
  const location = useLocation();
  const logoutTriggered = useRef(false);

  const { data: isAdmin, isLoading: adminLoading } = useQuery({
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

  const isPublicRoute =
    PUBLIC_ROUTES.includes(location.pathname) ||
    PUBLIC_PREFIXES.some((p) => location.pathname.startsWith(p));

  // Force logout: if force_logout_at is set and session was created before it
  useEffect(() => {
    if (!forceLogoutAt || !session || !user || logoutTriggered.current) return;
    if (isAdmin) return; // admins bypass

    const forceAt = new Date(forceLogoutAt).getTime();
    // Use token iat (issued at) - session.expires_at is expiry epoch in seconds
    const tokenIssuedAt = session.expires_at
      ? (session.expires_at - 3600) * 1000
      : Date.now();

    if (tokenIssuedAt < forceAt) {
      logoutTriggered.current = true;
      console.log("[MaintenanceGuard] Force logout triggered");
      supabase.auth.signOut().then(() => {
        navigate("/manutencao", { replace: true });
      });
    }
  }, [forceLogoutAt, session, user, isAdmin, navigate]);

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

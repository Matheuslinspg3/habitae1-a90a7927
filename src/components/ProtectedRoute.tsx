import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDemo } from "@/contexts/DemoContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";
import { TrialExpiredScreen } from "@/components/TrialExpiredScreen";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, trialInfo } = useAuth();
  const { isDemoMode } = useDemo();
  const { isDeveloperOrLeader, isLoading: rolesLoading } = useUserRoles();

  // Permitir acesso em modo demo
  if (isDemoMode) {
    return <>{children}</>;
  }

  if (loading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando sua sessão...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Trial expired check - developers/leaders bypass
  if (trialInfo?.is_trial_expired && !isDeveloperOrLeader) {
    return <TrialExpiredScreen />;
  }

  return <>{children}</>;
}

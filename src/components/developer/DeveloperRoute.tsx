import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

interface DeveloperRouteProps {
  children: ReactNode;
  requiredRole?: "developer" | "leader";
}

export function DeveloperRoute({ children, requiredRole = "developer" }: DeveloperRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isDeveloper, isLeader, isLoading: rolesLoading } = useUserRoles();

  if (authLoading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  const hasAccess = requiredRole === "developer" ? isDeveloper : (isDeveloper || isLeader);
  if (!hasAccess) return <Navigate to="/acesso-negado" replace />;

  return <>{children}</>;
}

import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

interface ManagerRouteProps {
  children: ReactNode;
}

export function ManagerRoute({ children }: ManagerRouteProps) {
  const { user, loading } = useAuth();
  const { isAdminOrAbove, isLoading: rolesLoading } = useUserRoles();

  if (loading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isAdminOrAbove) {
    return <Navigate to="/acesso-negado" replace />;
  }

  return <>{children}</>;
}

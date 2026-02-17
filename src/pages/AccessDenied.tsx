import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldX, Home, ArrowLeft } from "lucide-react";

export default function AccessDenied() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="text-center max-w-md space-y-6">
        <div className="space-y-3">
          <ShieldX className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-3xl font-extrabold font-display text-foreground">Acesso negado</h1>
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para acessar esta página. Se acredita que isso é um erro, entre em contato com o administrador da sua organização.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button asChild>
            <Link to="/dashboard">
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

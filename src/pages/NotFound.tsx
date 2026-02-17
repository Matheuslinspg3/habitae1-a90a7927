import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Building } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="text-center max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-extrabold font-display text-primary">404</h1>
          <p className="text-xl font-semibold text-foreground">Página não encontrada</p>
          <p className="text-sm text-muted-foreground">
            A página <code className="text-xs bg-muted-foreground/10 px-1.5 py-0.5 rounded">{location.pathname}</code> não existe ou foi movida.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button variant="outline" asChild>
            <Link to={-1 as unknown as string} onClick={(e) => { e.preventDefault(); window.history.back(); }}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard">
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/imoveis">
              <Building className="h-4 w-4 mr-2" />
              Imóveis
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

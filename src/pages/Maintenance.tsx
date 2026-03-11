import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { Button } from "@/components/ui/button";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { Construction, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Maintenance() {
  const { isMaintenanceMode, maintenanceMessage, refetch, isLoading } = useMaintenanceMode();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  // If maintenance is no longer active, redirect to dashboard
  useEffect(() => {
    if (!isLoading && !isMaintenanceMode) {
      navigate("/dashboard", { replace: true });
    }
  }, [isMaintenanceMode, isLoading, navigate]);

  const handleRetry = async () => {
    setChecking(true);
    await refetch();
    setTimeout(() => setChecking(false), 1000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <HabitaeLogo variant="icon" size="lg" />
        </div>

        {/* Maintenance icon */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Construction className="h-10 w-10 text-amber-500" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-foreground">
            Sistema em Manutenção
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            {maintenanceMessage}
          </p>
        </div>

        {/* Retry button */}
        <Button
          onClick={handleRetry}
          variant="outline"
          size="lg"
          disabled={checking}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Verificando..." : "Tentar novamente"}
        </Button>

        {/* Footer */}
        <p className="text-xs text-muted-foreground/50 tracking-widest uppercase">
          Porta do Corretor
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPPRESS_KEY = "sw-update-suppressed";

export function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // If user already clicked "Atualizar" recently, don't show again
    const suppressed = sessionStorage.getItem(SUPPRESS_KEY);
    if (suppressed) {
      // Clear the flag so future genuine updates show the banner
      sessionStorage.removeItem(SUPPRESS_KEY);
      return;
    }

    if (window.__newVersionAvailable) {
      setShow(true);
    }

    const handler = () => setShow(true);
    window.addEventListener("sw-update-available", handler);
    return () => window.removeEventListener("sw-update-available", handler);
  }, []);

  if (!show) return null;

  const handleUpdate = () => {
    sessionStorage.setItem(SUPPRESS_KEY, "1");
    window.location.reload();
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-4 duration-300 w-[calc(100%-2rem)] max-w-md">
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-lg">
        <RefreshCw className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Nova versão disponível!</p>
          <p className="text-xs text-muted-foreground">Recarregue para usar a versão mais recente.</p>
        </div>
        <Button size="sm" onClick={handleUpdate}>
          Atualizar
        </Button>
      </div>
    </div>
  );
}

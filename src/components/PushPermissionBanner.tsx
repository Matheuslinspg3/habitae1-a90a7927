import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getOneSignalRuntimeBlockReason } from "@/lib/onesignal";

const DISMISS_KEY = "push-banner-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function PushPermissionBanner() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, isLoading, permission, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(true);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw) {
      const ts = parseInt(raw, 10);
      if (Date.now() - ts < DISMISS_DURATION_MS) return;
    }
    setDismissed(false);
  }, [user]);

  if (!user || dismissed || isSubscribed || isLoading) return null;
  if (!isSupported || permission === "denied") return null;
  if (getOneSignalRuntimeBlockReason()) return null;

  const handleActivate = async () => {
    setActivating(true);
    const ok = await subscribe();
    setActivating(false);
    if (ok) setDismissed(true);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg mx-4 mt-3 p-3 flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
      <Bell className="h-5 w-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Ative as notificações push</p>
        <p className="text-xs text-muted-foreground">Receba alertas de novos leads e atualizações em tempo real.</p>
      </div>
      <Button size="sm" onClick={handleActivate} disabled={activating} className="shrink-0">
        {activating ? "Ativando..." : "Ativar"}
      </Button>
      <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground shrink-0 p-1" aria-label="Fechar">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

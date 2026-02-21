import { useEffect, useState } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "push_prompt_dismissed";

/**
 * Shows a one-time prompt to enable push notifications after login.
 * Dismisses permanently once the user acts (enable or dismiss).
 */
export function PushNotificationPrompt() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, subscribe, permission } = usePushNotifications();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user || !isSupported || isSubscribed || permission === "denied") return;

    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    // Show prompt after a short delay so the page loads first
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [user, isSupported, isSubscribed, permission]);

  if (!visible) return null;

  const handleEnable = async () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
    await subscribe();
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border shadow-lg rounded-lg p-4 flex items-start gap-3">
        <div className="p-2 rounded-full bg-primary/10 shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Ativar notificações?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Receba alertas de novos leads, compromissos e atualizações mesmo com o app fechado.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleEnable} className="gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Ativar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Agora não
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

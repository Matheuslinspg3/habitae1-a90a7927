import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { HabitaeLogo } from "@/components/HabitaeLogo";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export function PWAInstallPrompt() {
  const isMobile = useIsMobile();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only on mobile, not standalone
    if (!isMobile) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((navigator as any).standalone === true) return;

    // Check cooldown
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_COOLDOWN_MS) return;

    // Check if prompt was captured globally
    if (window.__pwaInstallPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt as BeforeInstallPromptEvent);
      setVisible(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isMobile]);

  // Also show for iOS (no beforeinstallprompt) - redirect to install page
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => {
    if (!isMobile) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((navigator as any).standalone === true) return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_COOLDOWN_MS) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (ios) {
      setIsIOS(true);
      setVisible(true);
    }
  }, [isMobile]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setVisible(false);
      setDeferredPrompt(null);
    } else if (isIOS) {
      window.location.href = "/instalar";
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 md:hidden animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-xl border bg-card shadow-lg p-3.5 flex items-center gap-3">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <HabitaeLogo size="sm" variant="icon" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">Instale o app</p>
          <p className="text-xs text-muted-foreground leading-snug mt-0.5">
            Acesso rápido, tela cheia e offline
          </p>
        </div>
        <Button size="sm" onClick={handleInstall} className="h-8 text-xs gap-1 shrink-0">
          <Download className="h-3.5 w-3.5" />
          Instalar
        </Button>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

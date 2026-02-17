import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HabitaeLogo } from '@/components/HabitaeLogo';
import { useNavigate } from 'react-router-dom';

const DISMISSED_KEY = 'habitae-pwa-banner-dismissed';

export function PWAInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    if (standalone) return;

    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) {
      const dismissedAt = new Date(dismissed);
      const daysSince = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return;
    }

    // Show after a short delay for better UX
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
  };

  const handleInstall = () => {
    navigate('/instalar');
    handleDismiss();
  };

  if (!visible || isStandalone) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-muted transition-colors"
        aria-label="Fechar"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <HabitaeLogo size="sm" variant="icon" />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="font-semibold text-sm text-foreground leading-tight">
            Instale o App Habitae
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Acesse direto da tela inicial do seu celular. Tela cheia, carregamento rápido e funciona offline.
          </p>

          <div className="flex flex-wrap gap-3 pt-1.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Smartphone className="h-3 w-3" /> Tela cheia
            </span>
            <span className="flex items-center gap-1">
              ⚡ Rápido
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" /> Offline
            </span>
          </div>

          <div className="pt-2">
            <Button size="sm" onClick={handleInstall} className="h-8 text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Como instalar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

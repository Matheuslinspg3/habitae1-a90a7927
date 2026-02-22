import { useState, useEffect } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HabitaeLogo } from '@/components/HabitaeLogo';
import { useNavigate } from 'react-router-dom';

export function PWAInstallBanner() {
  const [isStandalone, setIsStandalone] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
  }, []);

  if (isStandalone) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <HabitaeLogo size="sm" variant="icon" />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="font-semibold text-sm text-foreground leading-tight">
            Instale o App Porta do Corretor
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
            <Button size="sm" onClick={() => navigate('/instalar')} className="h-8 text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Como instalar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

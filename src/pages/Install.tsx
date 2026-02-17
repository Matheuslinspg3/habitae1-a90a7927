import { useState, useEffect } from "react";
import { Download, Smartphone, Share, MoreVertical, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HabitaeLogo } from "@/components/HabitaeLogo";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-semibold text-foreground">App Instalado!</h1>
          <p className="text-muted-foreground">O Habitae já está na sua tela inicial.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-6 bg-background">
      <div className="w-full max-w-md space-y-8 pt-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <HabitaeLogo size="lg" variant="icon" />
          <h1 className="text-2xl font-display font-semibold text-foreground">
            Instalar Habitae
          </h1>
          <p className="text-muted-foreground">
            Tenha o Habitae como app no seu celular. Acesso rápido, tela cheia e funciona offline.
          </p>
        </div>

        {deferredPrompt && (
          <Button onClick={handleInstall} size="lg" className="w-full gap-2">
            <Download className="h-5 w-5" />
            Instalar Agora
          </Button>
        )}

        {isIOS && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                Como instalar no iPhone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Step number={1} icon={<Share className="h-4 w-4" />} text='Toque no botão "Compartilhar" na barra do Safari' />
              <Step number={2} icon={<Plus className="h-4 w-4" />} text='Role para baixo e toque em "Adicionar à Tela de Início"' />
              <Step number={3} icon={<Check className="h-4 w-4" />} text='Toque em "Adicionar" para confirmar' />
            </CardContent>
          </Card>
        )}

        {!isIOS && !deferredPrompt && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                Como instalar no Android
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Step number={1} icon={<MoreVertical className="h-4 w-4" />} text="Toque no menu (⋮) do navegador" />
              <Step number={2} icon={<Download className="h-4 w-4" />} text='Toque em "Instalar aplicativo" ou "Adicionar à tela inicial"' />
              <Step number={3} icon={<Check className="h-4 w-4" />} text='Toque em "Instalar" para confirmar' />
            </CardContent>
          </Card>
        )}

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">✨ Tela cheia sem barra do navegador</p>
          <p className="text-sm text-muted-foreground">⚡ Carregamento instantâneo</p>
          <p className="text-sm text-muted-foreground">📱 Ícone na tela inicial</p>
        </div>
      </div>
    </div>
  );
}

function Step({ number, icon, text }: { number: number; icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
        {number}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm text-foreground">{text}</span>
      </div>
    </div>
  );
}

import { useState } from "react";
import { X, PartyPopper, Music } from "lucide-react";

export function CarnivalBanner() {
  const [dismissed, setDismissed] = useState(() =>
    sessionStorage.getItem("carnival-banner-2026") === "1"
  );

  if (dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem("carnival-banner-2026", "1");
    setDismissed(true);
  };

  return (
    <div className="carnival-banner relative overflow-hidden rounded-2xl p-4 sm:p-5 page-enter" style={{
      background: "linear-gradient(135deg, hsl(270 70% 50%), hsl(330 70% 55%), hsl(25 90% 55%), hsl(45 90% 55%))",
    }}>
      {/* Serpentina decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-2 -left-4 w-32 h-32 rounded-full opacity-20" style={{ background: "hsl(45 90% 55%)" }} />
        <div className="absolute -bottom-4 -right-4 w-40 h-40 rounded-full opacity-15" style={{ background: "hsl(150 60% 45%)" }} />
      </div>

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-2xl carnival-samba-pulse">
            <PartyPopper className="w-6 h-6 text-white" />
            <Music className="w-5 h-5 text-white/80" />
          </div>
          <div>
            <h3 className="font-display font-bold text-white text-sm sm:text-base">
              🎭 Carnaval 2026!
            </h3>
            <p className="text-white/80 text-xs sm:text-sm">
              Bons negócios e muita festa! A Habitae está no clima 🎉
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1.5 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
          aria-label="Fechar banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

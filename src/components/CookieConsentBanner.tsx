import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { loadClarityScript, setClarityConsent } from "@/lib/clarity";

const CONSENT_KEY = "porta_analytics_consent"; // "granted" | "denied"

export type ConsentStatus = "granted" | "denied" | null;

export function getStoredConsent(): ConsentStatus {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(CONSENT_KEY);
  if (v === "granted" || v === "denied") return v;
  return null;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored === null) {
      // No choice yet — show banner
      setVisible(true);
    } else if (stored === "granted") {
      // Previously accepted — load Clarity
      loadClarityScript();
      setClarityConsent(true);
    }
    // If "denied" — do nothing, Clarity not loaded
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "granted");
    loadClarityScript();
    // Small delay so Clarity queue is ready
    setTimeout(() => setClarityConsent(true), 200);
    setVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem(CONSENT_KEY, "denied");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9998] p-4 sm:p-6 pointer-events-none">
      <div className="max-w-lg mx-auto bg-card border border-border rounded-xl shadow-lg p-4 sm:p-5 pointer-events-auto animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 space-y-3">
            <p className="text-sm text-foreground leading-relaxed">
              Usamos cookies analíticos para melhorar sua experiência. Nenhum dado pessoal é compartilhado com terceiros.{" "}
              <a
                href="/privacidade"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-primary hover:text-primary/80 transition-colors"
              >
                Política de Privacidade
              </a>
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAccept} className="min-h-[36px]">
                Aceitar
              </Button>
              <Button size="sm" variant="outline" onClick={handleReject} className="min-h-[36px]">
                Rejeitar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

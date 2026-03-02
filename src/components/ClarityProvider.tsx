import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { clarityTag, clarityIdentify, clarityEvent } from "@/lib/clarity";
import { getStoredConsent } from "@/components/CookieConsentBanner";

/**
 * Tracks route changes and sets Clarity tags/events.
 * Only fires if consent was granted.
 */

function getPageType(pathname: string): string {
  if (pathname.startsWith("/auth")) return "auth";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/imoveis")) return "properties";
  if (pathname.startsWith("/crm")) return "crm";
  if (pathname.startsWith("/financeiro")) return "financial";
  if (pathname.startsWith("/contratos")) return "contracts";
  if (pathname.startsWith("/agenda")) return "schedule";
  if (pathname.startsWith("/configuracoes")) return "settings";
  if (pathname.startsWith("/marketplace")) return "marketplace";
  if (pathname.startsWith("/integracoes")) return "integrations";
  if (pathname.startsWith("/anuncios")) return "ads";
  if (pathname.startsWith("/automacoes")) return "automations";
  if (pathname.startsWith("/proprietarios")) return "owners";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/developer")) return "developer";
  if (pathname.startsWith("/app")) return "consumer_app";
  if (pathname === "/privacidade") return "privacy";
  if (pathname.startsWith("/imovel/") || pathname.startsWith("/i/")) return "landing";
  return "other";
}

export function ClarityProvider() {
  const location = useLocation();
  const { user } = useAuth();

  // Identify user (non-PII uuid only)
  useEffect(() => {
    if (user?.id && getStoredConsent() === "granted") {
      clarityIdentify(user.id);
    }
  }, [user?.id]);

  // Track page views / page type
  useEffect(() => {
    if (getStoredConsent() !== "granted") return;

    const pageType = getPageType(location.pathname);
    clarityTag("pageType", pageType);

    // Device hint
    const isMobile = window.innerWidth < 768;
    clarityTag("deviceHint", isMobile ? "mobile" : "desktop");
  }, [location.pathname]);

  return null;
}

// ---- Funnel events (call from components) ----
export function trackSignupSuccess() {
  if (getStoredConsent() !== "granted") return;
  clarityEvent("signup_success");
  clarityTag("flowStep", "signup_complete");
}

export function trackLoginSuccess() {
  if (getStoredConsent() !== "granted") return;
  clarityEvent("login_success");
  clarityTag("flowStep", "login_complete");
}

export function trackFormError(formName: string) {
  if (getStoredConsent() !== "granted") return;
  clarityEvent(`form_error_${formName}`);
}

export function trackLeadCreated() {
  if (getStoredConsent() !== "granted") return;
  clarityEvent("lead_created");
  clarityTag("flowStep", "lead_created");
}

export function trackPropertyCreated() {
  if (getStoredConsent() !== "granted") return;
  clarityEvent("property_created");
  clarityTag("flowStep", "property_created");
}

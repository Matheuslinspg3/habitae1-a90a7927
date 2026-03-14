import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { clarityEvent, clarityTag } from "@/lib/clarity";
import { getStoredConsent } from "@/components/CookieConsentBanner";

/**
 * Lightweight analytics hook for tracking user behavior.
 * All events are consent-gated (LGPD) and route through Clarity.
 */

// ---- Time-on-screen tracking ----
export function useScreenTime(screenName: string) {
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    return () => {
      if (getStoredConsent() !== "granted") return;
      const seconds = Math.round((Date.now() - startRef.current) / 1000);
      if (seconds >= 2) {
        clarityEvent(`screen_time_${screenName}`);
        clarityTag("lastScreenTime", `${screenName}:${seconds}s`);
      }
    };
  }, [screenName]);
}

// ---- Click / action tracking ----
export function useTrackAction() {
  return useCallback((action: string, meta?: Record<string, string>) => {
    if (getStoredConsent() !== "granted") return;
    clarityEvent(action);
    if (meta) {
      Object.entries(meta).forEach(([k, v]) => clarityTag(k, v));
    }
  }, []);
}

// ---- Module usage tracking ----
export function useModuleVisit() {
  const location = useLocation();

  useEffect(() => {
    if (getStoredConsent() !== "granted") return;
    const module = location.pathname.split("/")[1] || "home";
    clarityEvent(`module_visit_${module}`);
    clarityTag("currentModule", module);
  }, [location.pathname]);
}

// ---- Task completion tracking ----
export function trackTaskCompletion(taskName: string, durationMs?: number) {
  if (getStoredConsent() !== "granted") return;
  clarityEvent(`task_complete_${taskName}`);
  if (durationMs !== undefined) {
    clarityTag("taskDuration", `${taskName}:${Math.round(durationMs / 1000)}s`);
  }
}

// ---- Quick action tracking ----
export function trackQuickAction(actionName: string) {
  if (getStoredConsent() !== "granted") return;
  clarityEvent(`quick_action_${actionName}`);
}

// ---- Search tracking ----
export function trackSearch(module: string, hasResults: boolean) {
  if (getStoredConsent() !== "granted") return;
  clarityEvent(hasResults ? `search_success_${module}` : `search_empty_${module}`);
}

// ---- Filter usage tracking ----
export function trackFilterUsed(filterName: string) {
  if (getStoredConsent() !== "granted") return;
  clarityEvent(`filter_used_${filterName}`);
}

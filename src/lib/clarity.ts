/**
 * Microsoft Clarity utilities — consent-aware loading + helper API.
 *
 * Clarity is ONLY loaded after the user grants consent (LGPD).
 * Until then, consentv2 is set to "denied" and no cookies are created.
 */

const CLARITY_PROJECT_ID = "vpil7qz4th";

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

let clarityLoaded = false;

/** Inject Clarity script into <head> (runs once) */
export function loadClarityScript(): void {
  if (clarityLoaded || typeof document === "undefined") return;
  clarityLoaded = true;

  (function (c: any, l: Document, a: string, r: string, i: string) {
    c[a] = c[a] || function (...args: unknown[]) {
      (c[a].q = c[a].q || []).push(args);
    };
    const t = l.createElement(r) as HTMLScriptElement;
    t.async = true;
    t.src = `https://www.clarity.ms/tag/${i}`;
    const y = l.getElementsByTagName(r)[0];
    y?.parentNode?.insertBefore(t, y);
  })(window, document, "clarity", "script", CLARITY_PROJECT_ID);
}

/** Set Consent V2 flags */
export function setClarityConsent(granted: boolean): void {
  if (!window.clarity) return;
  window.clarity("consent");
  window.clarity("set", "consent_analytics", granted ? "granted" : "denied");
}

/** Set a custom tag (key/value) */
export function clarityTag(key: string, value: string): void {
  window.clarity?.("set", key, value);
}

/** Fire a custom event */
export function clarityEvent(name: string): void {
  window.clarity?.("event", name);
}

/** Identify user with non-PII id */
export function clarityIdentify(userId: string): void {
  // Only pass uuid — never email/phone
  window.clarity?.("identify", userId);
}

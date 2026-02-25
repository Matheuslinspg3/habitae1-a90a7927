/**
 * PWA utility helpers for diagnostics and repair.
 */

export interface PwaDiagnostics {
  displayMode: "standalone" | "browser" | "twa" | "unknown";
  swActive: string | null;
  swWaiting: boolean;
  swScope: string | null;
  manifestUrl: string | null;
  buildVersion: string | null;
  cacheNames: string[];
}

/** Detect current display mode */
export function getDisplayMode(): PwaDiagnostics["displayMode"] {
  if (window.matchMedia("(display-mode: standalone)").matches) return "standalone";
  if ((navigator as any).standalone === true) return "standalone"; // iOS
  if (document.referrer.includes("android-app://")) return "twa";
  return "browser";
}

/** Gather full PWA diagnostics */
export async function getPwaDiagnostics(): Promise<PwaDiagnostics> {
  const diag: PwaDiagnostics = {
    displayMode: getDisplayMode(),
    swActive: null,
    swWaiting: false,
    swScope: null,
    manifestUrl: null,
    buildVersion: null,
    cacheNames: [],
  };

  // SW info
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      diag.swActive = reg.active?.scriptURL ?? null;
      diag.swWaiting = !!reg.waiting;
      diag.swScope = reg.scope;
    }
  }

  // Manifest link
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  diag.manifestUrl = link?.href ?? null;

  // Build version from version.json
  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      diag.buildVersion = data.version ?? null;
    }
  } catch { /* ignore */ }

  // Cache names
  if ("caches" in window) {
    try {
      diag.cacheNames = await caches.keys();
    } catch { /* ignore */ }
  }

  return diag;
}

/** Force SW update + clear runtime caches */
export async function repairPwa(): Promise<{ cleared: number; updated: boolean }> {
  let cleared = 0;
  let updated = false;

  // 1. Force SW update
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      try {
        await reg.update();
        updated = true;
      } catch { /* ignore */ }
    }
  }

  // 2. Clear all runtime caches (not SW precache — that's managed by workbox)
  if ("caches" in window) {
    const keys = await caches.keys();
    for (const key of keys) {
      await caches.delete(key);
      cleared++;
    }
  }

  return { cleared, updated };
}

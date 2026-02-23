import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";


// Capture beforeinstallprompt globally so it's available even if Install page mounts later
declare global {
  interface WindowEventMap {
    beforeinstallprompt: Event;
  }
  interface Window {
    __pwaInstallPrompt: Event | null;
    __newVersionAvailable: boolean;
  }
}
window.__pwaInstallPrompt = null;
window.__newVersionAvailable = false;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__pwaInstallPrompt = e;
});

/** Fire-and-forget Cloudflare cache purge */
async function autoPurgeCloudflare() {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (!projectId) return;
    const url = `https://${projectId}.supabase.co/functions/v1/cloudflare-purge-cache`;
    // Use anon key — the function validates auth internally
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // Try to get a valid session token for auth
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || anonKey;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": anonKey,
      },
    });
    const data = await res.json();
    console.log("[Auto-Purge] Cloudflare cache purge:", data.success ? "✅ OK" : "❌ Failed", data);
  } catch (e) {
    console.warn("[Auto-Purge] Could not purge Cloudflare cache:", e);
  }
}

function setupServiceWorkerUpdateRoutine() {
  if (!("serviceWorker" in navigator)) return;

  const handleNewVersion = (registration: ServiceWorkerRegistration) => {
    console.log("[SW Update] Nova versão detectada! Purging Cloudflare e notificando usuário...");
    
    // 1. Auto-purge Cloudflare cache
    autoPurgeCloudflare();
    
    // 2. Signal the app to show a reload banner
    window.__newVersionAvailable = true;
    window.dispatchEvent(new CustomEvent("sw-update-available"));
    
    // 3. Force the new SW to activate
    const waiting = registration.waiting;
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
    }
  };

  const observeRegistration = (registration: ServiceWorkerRegistration | undefined) => {
    if (!registration) return;

    if (registration.waiting) {
      handleNewVersion(registration);
    }

    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          handleNewVersion(registration);
        }
      });
    });
  };

  // When a new SW takes control after user clicks reload
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    console.log("[SW Update] Novo SW ativo, recarregando...");
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    registrations.forEach((reg) => {
      observeRegistration(reg);
      reg.update().catch(() => {});
    });
  });
}

// Client-side redirect: habitae1.lovable.app → portadocorretor.com.br
if (
  window.location.hostname === "habitae1.lovable.app" &&
  !window.location.hostname.includes("preview")
) {
  window.location.replace(
    `https://portadocorretor.com.br${window.location.pathname}${window.location.search}${window.location.hash}`
  );
} else {
  setupServiceWorkerUpdateRoutine();
  createRoot(document.getElementById("root")!).render(<App />);
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { APP_VERSION } from "./config/appVersion";


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

// autoPurgeCloudflare removed — domain connected directly to Lovable, no CDN to purge
// Version polling removed — relying solely on Service Worker update routine (setupServiceWorkerUpdateRoutine)

function setupServiceWorkerUpdateRoutine() {
  if (!("serviceWorker" in navigator)) return;

  const handleNewVersion = (registration: ServiceWorkerRegistration) => {
    console.log("[SW Update] Nova versão detectada!");
    window.__newVersionAvailable = true;
    window.dispatchEvent(new CustomEvent("sw-update-available"));
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

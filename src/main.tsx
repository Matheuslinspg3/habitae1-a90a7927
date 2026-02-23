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
  }
}
window.__pwaInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__pwaInstallPrompt = e;
});

function setupServiceWorkerUpdateRoutine() {
  if (!("serviceWorker" in navigator)) return;

  const forceActivate = (registration: ServiceWorkerRegistration) => {
    const waiting = registration.waiting;
    if (waiting) {
      console.log("[SW Update] Forçando skipWaiting no SW em espera");
      waiting.postMessage({ type: "SKIP_WAITING" });
    }
  };

  const observeRegistration = (registration: ServiceWorkerRegistration | undefined) => {
    if (!registration) return;

    // Se já tem um worker esperando, forçar ativação imediata
    if (registration.waiting) {
      forceActivate(registration);
    }

    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          console.log("[SW Update] Novo SW instalado, forçando ativação");
          forceActivate(registration);
        }
      });
    });
  };

  // Quando um novo SW assume controle, recarregar automaticamente
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
      // Forçar checagem de atualização
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

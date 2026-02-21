import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const FIREBASE_SW_SCOPE = "/firebase-cloud-messaging-push-scope/";

function setupServiceWorkerUpdateRoutine() {
  if (!("serviceWorker" in navigator)) return;

  const promptRefresh = (reason: string) => {
    console.log("[SW Update] Nova versão detectada", { reason });
    const shouldReload = window.confirm(
      "Uma nova versão do app está disponível. Clique em OK para atualizar agora."
    );
    if (shouldReload) {
      window.location.reload();
    }
  };

  const observeRegistration = (registration: ServiceWorkerRegistration | undefined) => {
    if (!registration) return;

    if (registration.waiting) {
      promptRefresh("waiting-worker");
    }

    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          promptRefresh("installed-worker");
        }
      });
    });
  };

  window.addEventListener("load", async () => {
    const registration = await navigator.serviceWorker.getRegistration(FIREBASE_SW_SCOPE);
    observeRegistration(registration);

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("[SW Update] controllerchange");
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

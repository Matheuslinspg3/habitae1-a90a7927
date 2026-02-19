import { initializeApp, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

const FALLBACK_CONFIG = {
  apiKey: "AIzaSyAzZKKnALAb-uoUtlvhGDFZ5Gf0huxQqr8",
  authDomain: "habitaae.firebaseapp.com",
  projectId: "habitaae",
  storageBucket: "habitaae.firebasestorage.app",
  messagingSenderId: "671342372376",
  appId: "1:671342372376:web:dae51e941e38742ef3856d",
  measurementId: "G-YQ0HY6PFL0",
};

function getFirebaseConfig() {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      console.error("Invalid VITE_FIREBASE_CONFIG");
    }
  }
  return FALLBACK_CONFIG;
}

export function initFirebase(): FirebaseApp | null {
  if (app) return app;

  const config = getFirebaseConfig();
  if (!config) {
    console.warn("Firebase config not available");
    return null;
  }

  try {
    app = initializeApp(config);
    return app;
  } catch (e) {
    console.error("Firebase init error:", e);
    return null;
  }
}

export function getFirebaseMessaging(): Messaging | null {
  if (messaging) return messaging;

  const firebaseApp = initFirebase();
  if (!firebaseApp) return null;

  try {
    messaging = getMessaging(firebaseApp);
    return messaging;
  } catch (e) {
    console.error("Firebase messaging init error:", e);
    return null;
  }
}

export async function requestPushToken(vapidKey: string): Promise<string | null> {
  const msg = getFirebaseMessaging();
  if (!msg) return null;

  try {
    // Send config to the service worker
    const config = getFirebaseConfig();
    if (config && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "FIREBASE_CONFIG",
        config,
      });
    }

    // Also send to all active service workers
    const registration = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    if (registration?.active) {
      registration.active.postMessage({
        type: "FIREBASE_CONFIG",
        config,
      });
    }

    const token = await getToken(msg, {
      vapidKey,
      serviceWorkerRegistration: registration || undefined,
    });

    return token || null;
  } catch (e) {
    console.error("Error getting push token:", e);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: any) => void) {
  const msg = getFirebaseMessaging();
  if (!msg) return () => {};

  return onMessage(msg, callback);
}

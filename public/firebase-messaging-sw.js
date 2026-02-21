/* eslint-disable no-undef */
// Firebase Messaging Service Worker
// Version must stay in sync with the app's firebase package (^12.x)

importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js");

// Activate new SW immediately (don't wait for old tabs to close)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

firebase.initializeApp({
  apiKey: "AIzaSyAzZKKnALAb-uoUtlvhGDFZ5Gf0huxQqr8",
  authDomain: "habitaae.firebaseapp.com",
  projectId: "habitaae",
  storageBucket: "habitaae.firebasestorage.app",
  messagingSenderId: "671342372376",
  appId: "1:671342372376:web:dae51e941e38742ef3856d",
  measurementId: "G-YQ0HY6PFL0",
});

let messaging = null;
try {
  messaging = firebase.messaging();
  console.log("[firebase-messaging-sw] SW inicializado com sucesso");
} catch (e) {
  console.error("[firebase-messaging-sw] Erro ao inicializar messaging:", e);
}

// Handle background messages via Firebase SDK
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log("[firebase-messaging-sw] onBackgroundMessage:", JSON.stringify(payload));

    const data = payload.data || {};
    const title = data.title || payload.notification?.title || "Habitae";
    const body = data.message || payload.notification?.body || "";

    // When the payload contains a `notification` field, the browser auto-shows it.
    // Only show manually for data-only messages.
    if (!payload.notification) {
      const notificationOptions = {
        body,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        vibrate: [200, 100, 200],
        data: data,
        tag: data.notification_type || "default",
        renotify: true,
      };
      return self.registration.showNotification(title, notificationOptions);
    }
  });
}

// Fallback: raw push event listener
// This fires if Firebase SDK fails to handle the push event (e.g. SDK init error).
// Firebase SDK internally calls event.waitUntil() — if it handled the event,
// this listener still fires but showNotification is safe to call again with same tag.
self.addEventListener("push", (event) => {
  // Only act if we have push data and Firebase messaging failed to init
  if (!messaging && event.data) {
    let payload = {};
    try {
      payload = event.data.json();
    } catch {
      payload = { data: { title: "Nova notificação", message: event.data.text() } };
    }

    const data = payload.data || {};
    const notification = payload.notification || {};
    const title = notification.title || data.title || "Habitae";
    const body = notification.body || data.message || "";

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        vibrate: [200, 100, 200],
        data: data,
        tag: data.notification_type || "default",
        renotify: true,
      })
    );
  }
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  console.log("[firebase-messaging-sw] notificationclick:", event.notification.tag);
  event.notification.close();

  const data = event.notification.data || {};
  let url = "/dashboard";

  if (data.entity_type && data.entity_id) {
    switch (data.entity_type) {
      case "lead":
        url = `/crm?lead=${data.entity_id}`;
        break;
      case "property":
        url = `/imoveis/${data.entity_id}`;
        break;
      case "contract":
        url = `/contratos?id=${data.entity_id}`;
        break;
      case "appointment":
        url = `/agenda?id=${data.entity_id}`;
        break;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

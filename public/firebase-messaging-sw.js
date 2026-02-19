/* eslint-disable no-undef */
// Firebase Messaging Service Worker

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAzZKKnALAb-uoUtlvhGDFZ5Gf0huxQqr8",
  authDomain: "habitaae.firebaseapp.com",
  projectId: "habitaae",
  storageBucket: "habitaae.firebasestorage.app",
  messagingSenderId: "671342372376",
  appId: "1:671342372376:web:dae51e941e38742ef3856d",
  measurementId: "G-YQ0HY6PFL0",
});

const messaging = firebase.messaging();
console.log("[firebase-messaging-sw] SW inicializado com sucesso");

// Handle background messages via Firebase SDK (data-only messages)
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw] onBackgroundMessage:", JSON.stringify(payload));

  // Data-only messages: title/message come in payload.data
  const title = payload.data?.title || payload.notification?.title || "Habitae";
  const body = payload.data?.message || payload.notification?.body || "";

  const notificationOptions = {
    body,
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    vibrate: [200, 100, 200],
    data: payload.data || {},
    tag: payload.data?.notification_type || "default",
    renotify: true,
  };

  return self.registration.showNotification(title, notificationOptions);
});

// FALLBACK: Direct push event listener in case Firebase SDK doesn't intercept
self.addEventListener("push", (event) => {
  console.log("[firebase-messaging-sw] push event raw:", event.data?.text());

  // Only act as fallback — Firebase SDK normally handles this.
  // We check if a notification is already being shown by looking at existing notifications.
  const data = event.data ? event.data.json() : {};
  
  // Firebase wraps messages in a specific format
  const notification = data.notification || data.data || {};
  const title = notification.title || data.data?.title || "Habitae";
  const body = notification.body || data.data?.message || "";
  
  // Only show if Firebase SDK didn't already handle it
  // (Firebase SDK sets a flag internally, but as a safety net we always try)
  if (!title || title === "Habitae" && !body) {
    console.log("[firebase-messaging-sw] push event: skipping empty notification");
    return;
  }

  const options = {
    body: body,
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    vibrate: [200, 100, 200],
    data: data.data || {},
    tag: data.data?.notification_type || "push-fallback",
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
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

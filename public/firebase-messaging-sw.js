/* eslint-disable no-undef */
// Firebase Messaging Service Worker
// This file MUST be at the root of the public folder

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Firebase config will be injected via the main app
// The SW receives it through the messaging.onBackgroundMessage handler
firebase.initializeApp({
  // These will be populated by postMessage from the main thread
  apiKey: self.__FIREBASE_CONFIG__?.apiKey || "",
  authDomain: self.__FIREBASE_CONFIG__?.authDomain || "",
  projectId: self.__FIREBASE_CONFIG__?.projectId || "",
  storageBucket: self.__FIREBASE_CONFIG__?.storageBucket || "",
  messagingSenderId: self.__FIREBASE_CONFIG__?.messagingSenderId || "",
  appId: self.__FIREBASE_CONFIG__?.appId || "",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw] Background message:", payload);

  const notificationTitle = payload.notification?.title || "Habitae";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    vibrate: [200, 100, 200],
    data: payload.data || {},
    tag: payload.data?.notification_type || "default",
    renotify: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
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

// Listen for config from main thread
self.addEventListener("message", (event) => {
  if (event.data?.type === "FIREBASE_CONFIG") {
    self.__FIREBASE_CONFIG__ = event.data.config;
    // Re-initialize with actual config
    try {
      firebase.app().delete().then(() => {
        firebase.initializeApp(event.data.config);
      });
    } catch (e) {
      // Already initialized or error - ignore
    }
  }
});

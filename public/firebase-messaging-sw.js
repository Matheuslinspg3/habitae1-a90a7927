/* eslint-disable no-undef */
// Firebase Messaging Service Worker

importScripts("https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js");

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

const SW_VERSION = "2026.02.22";

console.log("[firebase-messaging-sw] SW inicializado", {
  version: SW_VERSION,
  timestamp: new Date().toISOString(),
  scope: self.registration?.scope,
});

// --- Lifecycle: immediate activation ---
self.addEventListener("install", (event) => {
  console.log("[firebase-messaging-sw] install", { version: SW_VERSION });
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  console.log("[firebase-messaging-sw] activate", { version: SW_VERSION });
  event.waitUntil(clients.claim());
});

// --- Payload normalization utilities ---
function parsePossibleJson(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}

function normalizeObject(value) {
  const parsed = parsePossibleJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return Object.keys(parsed).reduce((acc, key) => {
    acc[key] = parsePossibleJson(parsed[key]);
    return acc;
  }, {});
}

function normalizePayload(payload) {
  const data = normalizeObject(payload?.data);
  const notification = normalizeObject(payload?.notification);

  const title = data.title || notification.title || "Porta do Corretor";
  const body = data.body || data.message || notification.body || "";
  const collapseKey = data.collapse_key || data.collapseKey || payload?.collapseKey;
  const tag = data.tag || notification.tag || collapseKey || data.notification_type || "default";
  const icon = data.icon || notification.icon || "/pwa-192x192.png";
  const badge = data.badge || notification.badge || "/pwa-192x192.png";
  const link = data.link || notification.link || "/dashboard";

  return { title, body, tag, collapseKey, icon, badge, link, data, notification };
}

// --- Background message handler (deterministic showNotification) ---
// Data-only messages always trigger onBackgroundMessage reliably
messaging.onBackgroundMessage((payload) => {
  const normalized = normalizePayload(payload);

  console.log("[firebase-messaging-sw][received]", JSON.stringify({
    messageId: payload?.messageId,
    hasData: Boolean(payload?.data),
    hasNotification: Boolean(payload?.notification),
    tag: normalized.tag,
    title: normalized.title,
  }));

  const notificationOptions = {
    body: normalized.body,
    icon: normalized.icon,
    badge: normalized.badge,
    vibrate: [200, 100, 200],
    tag: normalized.tag,
    renotify: true,
    data: {
      ...normalized.data,
      __meta: {
        messageId: payload?.messageId || null,
        collapseKey: normalized.collapseKey || null,
        receivedAt: new Date().toISOString(),
        source: "firebase-messaging-sw",
      },
    },
  };

  console.log("[firebase-messaging-sw][render]", JSON.stringify({
    tag: notificationOptions.tag,
    title: normalized.title,
  }));

  return self.registration.showNotification(normalized.title, notificationOptions);
});

// --- Notification click handler ---
self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};

  console.log("[firebase-messaging-sw][click]", JSON.stringify({
    tag: event.notification.tag,
    entityType: data.entity_type,
    entityId: data.entity_id,
  }));

  event.notification.close();

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

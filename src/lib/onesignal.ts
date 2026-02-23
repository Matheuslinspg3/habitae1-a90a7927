import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void>;
    OneSignal?: any;
  }
}

let appIdCache: string | null = null;
let initPromise: Promise<boolean> | null = null;
let sdkReady = false;

/** Fetch OneSignal App ID from edge function */
async function fetchAppId(): Promise<string | null> {
  if (appIdCache) return appIdCache;
  try {
    const { data, error } = await supabase.functions.invoke("onesignal-app-id");
    if (error || !data?.app_id) {
      console.warn("[OneSignal] Failed to fetch App ID:", error);
      return null;
    }
    appIdCache = data.app_id;
    return appIdCache;
  } catch (e) {
    console.warn("[OneSignal] Error fetching App ID:", e);
    return null;
  }
}

/** Wait for the OneSignal SDK script to be loaded and available */
function waitForSDK(timeoutMs = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.OneSignal && typeof window.OneSignal.init === "function") {
      return resolve(window.OneSignal);
    }

    const start = Date.now();
    const check = setInterval(() => {
      if (window.OneSignal && typeof window.OneSignal.init === "function") {
        clearInterval(check);
        resolve(window.OneSignal);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(check);
        reject(new Error("OneSignal SDK load timeout"));
      }
    }, 200);
  });
}

/** Initialize OneSignal — returns true if ready */
export async function initOneSignal(): Promise<boolean> {
  if (sdkReady) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const appId = await fetchAppId();
      if (!appId) {
        console.warn("[OneSignal] App ID not available — push disabled");
        return false;
      }

      const OneSignal = await waitForSDK();

      await OneSignal.init({
        appId,
        serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "/push/onesignal/" },
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false },
      });

      console.log("[OneSignal] SDK initialized successfully");
      sdkReady = true;
      return true;
    } catch (err) {
      console.error("[OneSignal] Init failed:", err);
      initPromise = null; // allow retry
      return false;
    }
  })();

  return initPromise;
}

/** Login user + re-opt-in if permission was already granted */
export async function loginOneSignal(userId: string): Promise<void> {
  const ready = await initOneSignal();
  if (!ready || !window.OneSignal) {
    console.warn("[OneSignal] SDK not ready, skipping login");
    return;
  }

  try {
    await window.OneSignal.login(userId);
    console.log("[OneSignal] User logged in:", userId);

    // Re-opt in if permission was granted but subscription dropped
    const permission = window.OneSignal.Notifications?.permission;
    if (permission === true) {
      const optedIn = window.OneSignal.User?.PushSubscription?.optedIn;
      if (optedIn === false) {
        await window.OneSignal.User.PushSubscription.optIn();
        console.log("[OneSignal] Re-opted in user after login");
      }
    }
  } catch (e) {
    console.error("[OneSignal] Login error:", e);
  }
}

/** Logout user from OneSignal */
export async function logoutOneSignal(): Promise<void> {
  try {
    if (window.OneSignal) {
      await window.OneSignal.logout();
      console.log("[OneSignal] User logged out");
    }
  } catch (e) {
    console.error("[OneSignal] Logout error:", e);
  }
}

/** Check if push is supported */
export function isPushSupported(): boolean {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

/** Get current permission state */
export function getPermissionState(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

/** Request push permission */
export async function requestPushPermission(): Promise<boolean> {
  const ready = await initOneSignal();
  if (!ready || !window.OneSignal) return false;

  try {
    await window.OneSignal.Notifications.requestPermission();
    return Notification.permission === "granted";
  } catch (e) {
    console.error("[OneSignal] Permission request error:", e);
    return false;
  }
}

/** Get diagnostic info */
export function getDiagnostics(): Record<string, unknown> {
  const info: Record<string, unknown> = {
    appIdCached: !!appIdCache,
    sdkLoaded: !!window.OneSignal,
    sdkReady,
    notificationPermission: "Notification" in window ? Notification.permission : "unsupported",
    serviceWorkerSupported: "serviceWorker" in navigator,
    pushManagerSupported: "PushManager" in window,
    isSecureContext: window.isSecureContext,
    hostname: window.location.hostname,
  };

  if (window.OneSignal) {
    try {
      const pushSub = window.OneSignal.User?.PushSubscription;
      info.oneSignalPermission = window.OneSignal.Notifications?.permission;
      info.pushSubscriptionId = pushSub?.id || null;
      info.pushToken = pushSub?.token ? `${pushSub.token.substring(0, 20)}...` : null;
      info.pushOptedIn = pushSub?.optedIn;
    } catch {
      info.oneSignalError = "Failed to read OneSignal state";
    }
  }

  return info;
}

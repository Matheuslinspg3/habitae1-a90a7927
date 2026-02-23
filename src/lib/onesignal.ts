import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void>;
    OneSignal?: any;
  }
}

let appIdCache: string | null = null;
let sdkReady = false;
let sdkReadyPromise: Promise<boolean> | null = null;
let sdkReadyResolve: ((v: boolean) => void) | null = null;

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

/** Initialize OneSignal using the official OneSignalDeferred queue pattern */
export async function initOneSignal(): Promise<boolean> {
  if (sdkReady) return true;
  if (sdkReadyPromise) return sdkReadyPromise;

  sdkReadyPromise = new Promise<boolean>((resolve) => {
    sdkReadyResolve = resolve;
  });

  const appId = await fetchAppId();
  if (!appId) {
    console.warn("[OneSignal] App ID not available — push disabled");
    sdkReadyResolve?.(false);
    sdkReadyPromise = null;
    return false;
  }

  // Use the official OneSignalDeferred queue pattern (SDK v16)
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      await OneSignal.init({
        appId,
        serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "/push/onesignal/" },
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false },
      });
      console.log("[OneSignal] SDK initialized via Deferred queue ✅");
      sdkReady = true;
      sdkReadyResolve?.(true);
    } catch (err) {
      console.error("[OneSignal] Init failed:", err);
      sdkReadyResolve?.(false);
      sdkReadyPromise = null;
    }
  });

  return sdkReadyPromise;
}

/** Wait for SDK to be ready with a timeout */
async function waitForReady(timeoutMs = 15000): Promise<boolean> {
  if (sdkReady) return true;
  
  const ready = initOneSignal();
  const timeout = new Promise<boolean>((resolve) =>
    setTimeout(() => resolve(false), timeoutMs)
  );
  
  return Promise.race([ready, timeout]);
}

/** Login user + re-opt-in if permission was already granted */
export async function loginOneSignal(userId: string): Promise<void> {
  const ready = await waitForReady();
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

    // Poll for token to confirm registration
    let attempts = 0;
    const maxAttempts = 10;
    const pollInterval = 500;
    
    const poll = () => {
      return new Promise<void>((resolve) => {
        const check = setInterval(() => {
          attempts++;
          const token = window.OneSignal?.User?.PushSubscription?.token;
          if (token) {
            clearInterval(check);
            console.log("[OneSignal] Token confirmed after login ✅ (attempt", attempts, ")");
            resolve();
          } else if (attempts >= maxAttempts) {
            clearInterval(check);
            console.warn("[OneSignal] Token not found after", maxAttempts, "attempts. Permission:", 
              window.OneSignal?.Notifications?.permission,
              "OptedIn:", window.OneSignal?.User?.PushSubscription?.optedIn);
            resolve();
          }
        }, pollInterval);
      });
    };

    await poll();
  } catch (e) {
    console.error("[OneSignal] Login error:", e);
  }
}

/** Logout user from OneSignal */
export async function logoutOneSignal(): Promise<void> {
  try {
    if (window.OneSignal && sdkReady) {
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
  const ready = await waitForReady();
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

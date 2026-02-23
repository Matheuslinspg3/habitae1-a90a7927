import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void>;
    OneSignal?: any;
  }
}

let initialized = false;
let appIdCache: string | null = null;

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

/** Load OneSignal SDK script if not already loaded */
function loadSDKScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.OneSignal) {
      resolve();
      return;
    }
    if (document.querySelector('script[src*="OneSignalSDK"]')) {
      // Script exists but OneSignal not ready yet — wait a bit
      const check = setInterval(() => {
        if (window.OneSignal) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(); }, 5000);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load OneSignal SDK"));
    document.head.appendChild(script);
  });
}

/** Initialize OneSignal */
export async function initOneSignal(): Promise<boolean> {
  if (initialized && window.OneSignal) return true;

  const appId = await fetchAppId();
  if (!appId) {
    console.warn("[OneSignal] App ID not available — push disabled");
    return false;
  }

  try {
    await loadSDKScript();

    // If OneSignal is already initialized (e.g. page reload), skip init
    if (window.OneSignal?.Notifications) {
      console.log("[OneSignal] SDK already initialized (reuse)");
      initialized = true;
      return true;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    
    return new Promise<boolean>((resolve) => {
      window.OneSignalDeferred!.push(async (OneSignal: any) => {
        try {
          await OneSignal.init({
            appId,
            allowLocalhostAsSecureOrigin: true,
            // Use dedicated scope to avoid conflict with PWA Workbox SW
            serviceWorkerParam: { scope: "/push/onesignal/" },
            serviceWorkerPath: "/push/onesignal/OneSignalSDKWorker.js",
          });
          initialized = true;
          
          // Log detailed subscription state for debugging
          const permission = OneSignal.Notifications?.permission;
          const pushSub = OneSignal.User?.PushSubscription;
          console.log("[OneSignal] SDK initialized successfully", {
            permission,
            pushSubscriptionId: pushSub?.id,
            pushSubscriptionToken: pushSub?.token ? "present" : "missing",
            optedIn: pushSub?.optedIn,
          });
          
          resolve(true);
        } catch (initErr) {
          console.error("[OneSignal] SDK init failed:", initErr);
          resolve(false);
        }
      });
    });
  } catch (e) {
    console.error("[OneSignal] Init error:", e);
    return false;
  }
}

/** Set external user ID for targeting */
export async function setExternalUserId(userId: string): Promise<void> {
  try {
    if (window.OneSignal) {
      await window.OneSignal.login(userId);
      
      // Log subscription state after login
      const pushSub = window.OneSignal.User?.PushSubscription;
      console.log("[OneSignal] User logged in:", {
        userId,
        pushSubscriptionId: pushSub?.id,
        pushToken: pushSub?.token ? "present" : "missing",
        optedIn: pushSub?.optedIn,
      });
    } else {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        await OneSignal.login(userId);
        console.log("[OneSignal] User logged in (deferred):", userId);
      });
    }
  } catch (e) {
    console.error("[OneSignal] Error setting external user ID:", e);
  }
}

/** Remove external user ID on logout */
export async function removeExternalUserId(): Promise<void> {
  try {
    if (window.OneSignal) {
      await window.OneSignal.logout();
      console.log("[OneSignal] User logged out");
    }
  } catch (e) {
    console.error("[OneSignal] Error removing external user ID:", e);
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

/** Opt in to push notifications */
export async function optInPush(): Promise<boolean> {
  try {
    if (!window.OneSignal) return false;
    
    await window.OneSignal.Notifications.requestPermission();
    
    // After permission granted, check if push subscription was created
    const pushSub = window.OneSignal.User?.PushSubscription;
    console.log("[OneSignal] After optIn:", {
      permission: Notification.permission,
      pushSubscriptionId: pushSub?.id,
      pushToken: pushSub?.token ? "present" : "missing",
      optedIn: pushSub?.optedIn,
    });
    
    return Notification.permission === "granted";
  } catch (e) {
    console.error("[OneSignal] Error opting in:", e);
    return false;
  }
}

/** Opt out of push notifications */
export async function optOutPush(): Promise<void> {
  try {
    if (window.OneSignal) {
      await window.OneSignal.logout();
    }
  } catch (e) {
    console.error("[OneSignal] Error opting out:", e);
  }
}

/** Get detailed diagnostic info */
export function getDiagnostics(): Record<string, unknown> {
  const info: Record<string, unknown> = {
    initialized,
    appIdCached: !!appIdCache,
    sdkLoaded: !!window.OneSignal,
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

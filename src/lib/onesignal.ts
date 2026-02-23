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
    if (error || !data?.app_id) return null;
    appIdCache = data.app_id;
    return appIdCache;
  } catch {
    return null;
  }
}

/** Load OneSignal SDK script if not already loaded */
function loadSDKScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="OneSignalSDK"]')) {
      resolve();
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
  if (initialized) return true;

  const appId = await fetchAppId();
  if (!appId) {
    console.warn("[OneSignal] App ID not available");
    return false;
  }

  try {
    await loadSDKScript();

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    
    return new Promise<boolean>((resolve) => {
      window.OneSignalDeferred!.push(async (OneSignal: any) => {
        try {
          await OneSignal.init({
            appId,
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerParam: { scope: "/" },
            serviceWorkerPath: "/OneSignalSDKWorker.js",
          });
          console.log("[OneSignal] SDK initialized successfully");
          initialized = true;
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
      console.log("[OneSignal] External user ID set:", userId);
    } else {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        await OneSignal.login(userId);
        console.log("[OneSignal] External user ID set (deferred):", userId);
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

/** Request push permission via OneSignal */
export async function requestPushPermission(): Promise<boolean> {
  try {
    if (window.OneSignal) {
      await window.OneSignal.Slidedown.promptPush();
      return Notification.permission === "granted";
    }
    return false;
  } catch (e) {
    console.error("[OneSignal] Error requesting permission:", e);
    return false;
  }
}

/** Check if user is subscribed */
export async function isUserSubscribed(): Promise<boolean> {
  try {
    if (window.OneSignal) {
      const isPushEnabled = window.OneSignal.Notifications.permission;
      return isPushEnabled === true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Opt in to push notifications */
export async function optInPush(): Promise<boolean> {
  try {
    if (window.OneSignal) {
      await window.OneSignal.Notifications.requestPermission();
      return Notification.permission === "granted";
    }
    return false;
  } catch (e) {
    console.error("[OneSignal] Error opting in:", e);
    return false;
  }
}

/** Opt out of push notifications */
export async function optOutPush(): Promise<void> {
  try {
    if (window.OneSignal) {
      // OneSignal doesn't have a direct opt-out for web,
      // but we can remove the external user ID
      await window.OneSignal.logout();
    }
  } catch (e) {
    console.error("[OneSignal] Error opting out:", e);
  }
}

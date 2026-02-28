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

async function registerCurrentDevice() {
  const pushSub = window.OneSignal?.User?.PushSubscription;
  const onesignalId = pushSub?.id;

  if (!onesignalId) return;

  await supabase.functions.invoke("notifications-register-device", {
    body: {
      onesignalId,
      platform: "web",
      metadata: {
        tokenAvailable: !!pushSub?.token,
        optedIn: !!pushSub?.optedIn,
        userAgent: navigator.userAgent,
      },
    },
  });
}

export async function initOneSignal(): Promise<boolean> {
  if (sdkReady) return true;
  if (sdkReadyPromise) return sdkReadyPromise;

  sdkReadyPromise = new Promise<boolean>((resolve) => {
    sdkReadyResolve = resolve;
  });

  const appId = await fetchAppId();
  if (!appId) {
    sdkReadyResolve?.(false);
    sdkReadyPromise = null;
    return false;
  }

  const doInit = async (OneSignal: any) => {
    try {
      await OneSignal.init({
        appId,
        serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
        serviceWorkerParam: { scope: "/push/onesignal/" },
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false },
      });
      sdkReady = true;
      sdkReadyResolve?.(true);
    } catch (e) {
      console.error("[OneSignal] init error:", e);
      // If already initialized, treat as ready
      if (window.OneSignal?.Notifications) {
        sdkReady = true;
        sdkReadyResolve?.(true);
      } else {
        sdkReadyResolve?.(false);
        sdkReadyPromise = null;
      }
    }
  };

  // If SDK is already loaded (script processed before this runs), call directly
  if (window.OneSignal && typeof window.OneSignal.init === "function") {
    console.log("[OneSignal] SDK already loaded, initializing directly");
    await doInit(window.OneSignal);
  } else {
    // SDK not yet loaded, use deferred queue
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(doInit);
  }

  return sdkReadyPromise;
}

async function waitForReady(timeoutMs = 15000): Promise<boolean> {
  if (sdkReady) return true;
  const ready = initOneSignal();
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs));
  return Promise.race([ready, timeout]);
}

export async function loginOneSignal(userId: string): Promise<void> {
  const ready = await waitForReady();
  if (!ready || !window.OneSignal) return;

  await window.OneSignal.login(userId);

  if (window.OneSignal.Notifications?.permission === true && window.OneSignal.User?.PushSubscription?.optedIn === false) {
    await window.OneSignal.User.PushSubscription.optIn();
  }

  let attempts = 0;
  const maxAttempts = 10;

  await new Promise<void>((resolve) => {
    const check = setInterval(async () => {
      attempts++;
      const subId = window.OneSignal?.User?.PushSubscription?.id;
      if (subId || attempts >= maxAttempts) {
        clearInterval(check);
        if (subId) {
          await registerCurrentDevice();
        }
        resolve();
      }
    }, 500);
  });
}

export async function logoutOneSignal(): Promise<void> {
  try {
    if (!window.OneSignal || !sdkReady) return;

    const onesignalId = window.OneSignal.User?.PushSubscription?.id;
    if (onesignalId) {
      await supabase.functions.invoke("notifications-register-device", {
        body: {
          action: "unregister",
          onesignalId,
          platform: "web",
        },
      });
    }

    await window.OneSignal.logout();
  } catch (e) {
    console.error("[OneSignal] Logout error:", e);
  }
}

export function isPushSupported(): boolean {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

export function getPermissionState(): NotificationPermission {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

export async function requestPushPermission(): Promise<boolean> {
  const ready = await waitForReady();
  if (!ready || !window.OneSignal) {
    console.warn("[OneSignal] SDK not ready for permission request");
    return false;
  }

  try {
    // If permission is already granted (user granted manually), just opt-in
    if (Notification.permission === "granted") {
      console.log("[OneSignal] Permission already granted, opting in...");
      try {
        if (window.OneSignal.User?.PushSubscription?.optedIn === false) {
          await window.OneSignal.User.PushSubscription.optIn();
        }
      } catch (e) {
        console.warn("[OneSignal] optIn error (non-fatal):", e);
      }
      // Wait a bit for subscription to propagate
      await new Promise(r => setTimeout(r, 1500));
      await registerCurrentDevice();
      return true;
    }

    // Otherwise request permission via OneSignal
    await window.OneSignal.Notifications.requestPermission();
    
    // Check result
    const granted = (Notification.permission as string) === "granted";
    if (granted) {
      // Ensure opt-in after permission grant
      try {
        if (window.OneSignal.User?.PushSubscription?.optedIn === false) {
          await window.OneSignal.User.PushSubscription.optIn();
        }
      } catch (e) {
        console.warn("[OneSignal] optIn after grant error:", e);
      }
      await new Promise(r => setTimeout(r, 1500));
      await registerCurrentDevice();
    }
    return granted;
  } catch (e) {
    console.error("[OneSignal] requestPermission error:", e);
    // Fallback: check if permission was actually granted despite error
    const perm = Notification.permission as string;
    if (perm === "granted") {
      await registerCurrentDevice();
      return true;
    }
    return false;
  }
}

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
    const pushSub = window.OneSignal.User?.PushSubscription;
    info.oneSignalPermission = window.OneSignal.Notifications?.permission;
    info.pushSubscriptionId = pushSub?.id || null;
    info.pushToken = pushSub?.token ? `${pushSub.token.substring(0, 20)}...` : null;
    info.pushOptedIn = pushSub?.optedIn;
  }

  return info;
}

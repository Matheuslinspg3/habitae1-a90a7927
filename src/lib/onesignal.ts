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

function getBasePath(): string {
  const raw = (import.meta.env.BASE_URL || "/").trim();
  if (!raw || raw === "/") return "/";
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function joinWithBase(relativePath: string): string {
  const base = getBasePath();
  const path = relativePath.replace(/^\//, "");
  return `${base}${path}`;
}

export function getOneSignalWorkerConfig() {
  return {
    serviceWorkerPath: joinWithBase("push/onesignal/OneSignalSDKWorker.js"),
    serviceWorkerScope: joinWithBase("push/onesignal/"),
  };
}

function isIOSDevice(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

function isStandalonePWA(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function getOneSignalRuntimeBlockReason(): string | null {
  if (!window.isSecureContext) {
    return "insecure-context";
  }

  if (window.self !== window.top) {
    return "iframe";
  }

  if (isIOSDevice() && !isStandalonePWA()) {
    return "ios-standalone-required";
  }

  return null;
}

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

export async function syncOneSignalDeviceRegistration(): Promise<boolean> {
  const pushSub = window.OneSignal?.User?.PushSubscription;
  const onesignalId = pushSub?.id;

  if (!onesignalId) return false;

  await supabase.functions.invoke("notifications-register-device", {
    body: {
      onesignalId,
      platform: "web",
      metadata: {
        tokenAvailable: !!pushSub?.token,
        optedIn: !!pushSub?.optedIn,
        userAgent: navigator.userAgent,
        host: window.location.host,
        path: window.location.pathname,
      },
    },
  });

  return true;
}

export async function initOneSignal(): Promise<boolean> {
  if (sdkReady) return true;
  if (sdkReadyPromise) return sdkReadyPromise;

  const blockReason = getOneSignalRuntimeBlockReason();
  if (blockReason) {
    console.warn(`[OneSignal] runtime blocked: ${blockReason}`);
    return false;
  }

  sdkReadyPromise = new Promise<boolean>((resolve) => {
    sdkReadyResolve = resolve;
  });

  const appId = await fetchAppId();
  if (!appId) {
    sdkReadyResolve?.(false);
    sdkReadyPromise = null;
    return false;
  }

  const worker = getOneSignalWorkerConfig();

  const doInit = async (OneSignal: any) => {
    try {
      await OneSignal.init({
        appId,
        serviceWorkerPath: worker.serviceWorkerPath,
        serviceWorkerParam: { scope: worker.serviceWorkerScope },
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false },
      });
      sdkReady = true;
      sdkReadyResolve?.(true);
    } catch (e) {
      console.error("[OneSignal] init error:", e);
      if (window.OneSignal?.Notifications) {
        sdkReady = true;
        sdkReadyResolve?.(true);
      } else {
        sdkReadyResolve?.(false);
        sdkReadyPromise = null;
      }
    }
  };

  if (window.OneSignal && typeof window.OneSignal.init === "function") {
    console.log("[OneSignal] SDK already loaded, initializing directly");
    await doInit(window.OneSignal);
  } else {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(doInit);

    setTimeout(() => {
      if (!sdkReady) {
        console.warn("[OneSignal] SDK deferred queue timeout – SDK may not be available in this environment");
        sdkReadyResolve?.(false);
        sdkReadyPromise = null;
      }
    }, 10000);
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
  const maxAttempts = 30;

  await new Promise<void>((resolve) => {
    const check = setInterval(async () => {
      attempts++;
      const subId = window.OneSignal?.User?.PushSubscription?.id;
      if (subId || attempts >= maxAttempts) {
        clearInterval(check);
        if (subId) {
          await syncOneSignalDeviceRegistration();
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
    if (Notification.permission === "granted") {
      console.log("[OneSignal] Permission already granted, opting in...");
      try {
        if (window.OneSignal.User?.PushSubscription?.optedIn === false) {
          await window.OneSignal.User.PushSubscription.optIn();
        }
      } catch (e) {
        console.warn("[OneSignal] optIn error (non-fatal):", e);
      }
      await new Promise((r) => setTimeout(r, 1500));
      await syncOneSignalDeviceRegistration();
      return true;
    }

    await window.OneSignal.Notifications.requestPermission();

    const granted = (Notification.permission as string) === "granted";
    if (granted) {
      try {
        if (window.OneSignal.User?.PushSubscription?.optedIn === false) {
          await window.OneSignal.User.PushSubscription.optIn();
        }
      } catch (e) {
        console.warn("[OneSignal] optIn after grant error:", e);
      }
      await new Promise((r) => setTimeout(r, 1500));
      await syncOneSignalDeviceRegistration();
    }
    return granted;
  } catch (e) {
    console.error("[OneSignal] requestPermission error:", e);
    const perm = Notification.permission as string;
    if (perm === "granted") {
      await syncOneSignalDeviceRegistration();
      return true;
    }
    return false;
  }
}

export function getDiagnostics(): Record<string, unknown> {
  const worker = getOneSignalWorkerConfig();

  const info: Record<string, unknown> = {
    appIdCached: !!appIdCache,
    sdkLoaded: !!window.OneSignal,
    sdkReady,
    notificationPermission: "Notification" in window ? Notification.permission : "unsupported",
    serviceWorkerSupported: "serviceWorker" in navigator,
    pushManagerSupported: "PushManager" in window,
    isSecureContext: window.isSecureContext,
    hostname: window.location.hostname,
    basePath: getBasePath(),
    workerPath: worker.serviceWorkerPath,
    workerScope: worker.serviceWorkerScope,
    blockReason: getOneSignalRuntimeBlockReason(),
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

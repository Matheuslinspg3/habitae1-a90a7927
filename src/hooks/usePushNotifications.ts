import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { requestPushToken, onForegroundMessage, getFirebaseMessaging } from "@/lib/firebase";
import { toast } from "sonner";

const DEVICE_ID_STORAGE_KEY = "push_device_id";
const VAPID_FALLBACK_KEY =
  "BIDDjcPovWWdlcmUXifYnLpoSkt8OhBDxAfgt0KYHjXIGK5-R9eseoKzxGZgTJf7fHJF46gKvZ_Dl31ZVAAmkVs";

function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}

export function usePushNotifications() {
  const { user, profile } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [canFetchToken, setCanFetchToken] = useState(true);

  const addDebug = useCallback((msg: string) => {
    console.log("[Push]", msg);
    setDebugInfo((prev) => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);

  const getCurrentFcmToken = useCallback(
    async (timeoutMs = 8000): Promise<string | null> => {
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || VAPID_FALLBACK_KEY;
      try {
        const token = await Promise.race([
          requestPushToken(vapidKey),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout ao obter token FCM")), timeoutMs)
          ),
        ]);
        if (!token) throw new Error("Token FCM não disponível");
        setCanFetchToken(true);
        return token;
      } catch {
        setCanFetchToken(false);
        return null;
      }
    },
    []
  );

  // Check support
  useEffect(() => {
    const supported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check subscription for current device token
  useEffect(() => {
    if (!user || !isSupported || Notification.permission !== "granted") {
      setIsSubscribed(false);
      return;
    }

    getCurrentFcmToken().then(async (token) => {
      if (!token) {
        setIsSubscribed(false);
        return;
      }
      const { data } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("fcm_token", token)
        .limit(1);
      setIsSubscribed((data?.length ?? 0) > 0);
    });
  }, [user, isSupported, getCurrentFcmToken]);

  // Listen for foreground messages
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 15;

    const setup = () => {
      if (cancelled || retryCount >= MAX_RETRIES) return;
      retryCount++;

      try {
        const unsub = onForegroundMessage((payload) => {
          const title = payload?.notification?.title || payload?.data?.title || "Nova notificação";
          const body = payload?.notification?.body || payload?.data?.message || "";

          toast(title, { description: body });
        });

        // onForegroundMessage returns () => {} even when messaging is null
        // Check if messaging was actually initialized
        if (getFirebaseMessaging()) {
          cleanup = unsub;
        } else {
          retryTimer = setTimeout(setup, 2000);
        }
      } catch {
        retryTimer = setTimeout(setup, 2000);
      }
    };

    setup();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (typeof cleanup === "function") cleanup();
    };
  }, []);

  const subscribe = useCallback(async () => {
    if (!user || !profile?.organization_id || !isSupported) return false;

    setIsLoading(true);
    setDebugInfo([]);
    try {
      addDebug("Solicitando permissão...");
      const perm = await Notification.requestPermission();
      setPermission(perm);
      addDebug(`Permissão: ${perm}`);

      if (perm !== "granted") {
        toast.error("Permissão de notificação negada");
        return false;
      }

      // Register Firebase SW with dedicated scope
      addDebug("Registrando Service Worker...");
      const FIREBASE_SW_SCOPE = "/firebase-cloud-messaging-push-scope/";
      let swReg = await navigator.serviceWorker.getRegistration(FIREBASE_SW_SCOPE);

      if (swReg) {
        addDebug(`SW encontrado (estado: ${swReg.active?.state || swReg.installing?.state || swReg.waiting?.state || "unknown"})`);
      } else {
        addDebug("SW não encontrado, registrando novo...");
        swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
          scope: FIREBASE_SW_SCOPE,
        });
        addDebug("SW registrado, aguardando ativação...");
      }

      // Wait for the SW to be active
      if (!swReg.active) {
        addDebug("Aguardando SW ficar ativo...");
        await new Promise<void>((resolve, reject) => {
          const sw = swReg!.installing || swReg!.waiting;
          if (!sw) {
            reject(new Error("Service Worker não encontrado após registro"));
            return;
          }
          const timeout = setTimeout(() => reject(new Error("Timeout aguardando SW ativar")), 10000);
          sw.addEventListener("statechange", () => {
            addDebug(`SW state: ${sw.state}`);
            if (sw.state === "activated") {
              clearTimeout(timeout);
              resolve();
            }
          });
          if (sw.state === "activated") {
            clearTimeout(timeout);
            resolve();
          }
        });
      }
      addDebug("SW ativo ✓");

      addDebug("Obtendo token FCM...");
      const token = await getCurrentFcmToken();
      if (!token) {
        addDebug("❌ Token não obtido");
        toast.error("Não foi possível obter token de push. Reative as notificações neste dispositivo.");
        return false;
      }
      addDebug(`Token obtido: ${token.substring(0, 20)}...`);

      // Upsert by (user_id, fcm_token) — preserves other devices
      addDebug("Salvando token no banco...");
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          organization_id: profile.organization_id,
          fcm_token: token,
          device_info: {
            device_id: getOrCreateDeviceId(),
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
          },
        },
        { onConflict: "user_id,fcm_token" }
      );

      if (error) {
        addDebug(`❌ Erro ao salvar: ${error.message}`);
        throw error;
      }

      addDebug("✅ Token salvo com sucesso!");
      setCanFetchToken(true);
      setIsSubscribed(true);
      toast.success("Notificações push ativadas!");
      return true;
    } catch (e: any) {
      console.error("Push subscription error:", e);
      addDebug(`❌ Erro: ${e.message || e}`);
      toast.error("Erro ao ativar notificações push: " + (e.message || "erro desconhecido"));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, profile, isSupported, addDebug, getCurrentFcmToken]);

  const unsubscribe = useCallback(async () => {
    if (!user || !isSupported) return;

    setIsLoading(true);
    try {
      const currentToken = await getCurrentFcmToken();
      if (currentToken) {
        // Delete only this device's token
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("fcm_token", currentToken);
      } else {
        // Fallback: can't get token, warn user
        toast.error("Não foi possível identificar o token deste dispositivo");
      }

      setIsSubscribed(false);
      toast.success("Notificações push desativadas neste dispositivo");
    } catch (e) {
      console.error("Push unsubscribe error:", e);
      toast.error("Erro ao desativar notificações push");
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported, getCurrentFcmToken]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    canFetchToken,
    subscribe,
    unsubscribe,
    debugInfo,
  };
}

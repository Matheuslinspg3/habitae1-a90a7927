import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { requestPushToken, onForegroundMessage } from "@/lib/firebase";
import { toast } from "sonner";

export function usePushNotifications() {
  const { user, profile } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebug = useCallback((msg: string) => {
    console.log("[Push]", msg);
    setDebugInfo((prev) => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);

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

  // Check existing subscription
  useEffect(() => {
    if (!user) return;

    supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .then(({ data }) => {
        setIsSubscribed((data?.length ?? 0) > 0);
      });
  }, [user]);

  // Listen for foreground messages
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      const title = payload?.notification?.title || "Nova notificação";
      const body = payload?.notification?.body || "";
      toast(title, { description: body });
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
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
        addDebug(`SW encontrado (estado: ${swReg.active?.state || swReg.installing?.state || swReg.waiting?.state || 'unknown'})`);
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

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || "BIDDjcPovWWdlcmUXifYnLpoSkt8OhBDxAfgt0KYHjXIGK5-R9eseoKzxGZgTJf7fHJF46gKvZ_Dl31ZVAAmkVs";
      
      addDebug("Obtendo token FCM...");
      const token = await requestPushToken(vapidKey);
      if (!token) {
        addDebug("❌ Token não obtido");
        toast.error("Não foi possível obter token de push");
        return false;
      }
      addDebug(`Token obtido: ${token.substring(0, 20)}...`);

      // Delete old subscriptions for this user first
      addDebug("Salvando token no banco...");
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id);

      const { error } = await supabase.from("push_subscriptions").insert({
        user_id: user.id,
        organization_id: profile.organization_id,
        fcm_token: token,
        device_info: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
        },
      });

      if (error) {
        addDebug(`❌ Erro ao salvar: ${error.message}`);
        throw error;
      }

      addDebug("✅ Token salvo com sucesso!");
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
  }, [user, profile, isSupported, addDebug]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id);

      setIsSubscribed(false);
      toast.success("Notificações push desativadas");
    } catch (e) {
      console.error("Push unsubscribe error:", e);
      toast.error("Erro ao desativar notificações push");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    debugInfo,
  };
}

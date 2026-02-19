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
      // Show toast for foreground notifications
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
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        toast.error("Permissão de notificação negada");
        return false;
      }

      // Register Firebase SW
      let swReg = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
      if (!swReg) {
        swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        // Wait for the SW to be ready
        await navigator.serviceWorker.ready;
      }

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.error("VITE_FIREBASE_VAPID_KEY not set");
        toast.error("Configuração de push incompleta");
        return false;
      }

      const token = await requestPushToken(vapidKey);
      if (!token) {
        toast.error("Não foi possível obter token de push");
        return false;
      }

      // Save token to database
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          organization_id: profile.organization_id,
          fcm_token: token,
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
          },
        },
        { onConflict: "user_id,fcm_token" }
      );

      if (error) throw error;

      setIsSubscribed(true);
      toast.success("Notificações push ativadas!");
      return true;
    } catch (e) {
      console.error("Push subscription error:", e);
      toast.error("Erro ao ativar notificações push");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, profile, isSupported]);

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
  };
}

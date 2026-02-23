import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  initOneSignal,
  setExternalUserId,
  removeExternalUserId,
  isPushSupported,
  getPermissionState,
  optInPush,
  optOutPush,
} from "@/lib/onesignal";
import { toast } from "sonner";

export function usePushNotifications() {
  const { user } = useAuth();
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
    const supported = isPushSupported();
    setIsSupported(supported);
    if (supported) {
      setPermission(getPermissionState());
    }
  }, []);

  // Initialize OneSignal and set external user ID
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const setup = async () => {
      const ok = await initOneSignal();
      if (cancelled || !ok) return;

      await setExternalUserId(user.id);

      // Check subscription state
      if (window.OneSignal) {
        const perm = window.OneSignal.Notifications?.permission;
        if (!cancelled) {
          setIsSubscribed(perm === true);
          setPermission(getPermissionState());
        }

        // Listen for permission changes
        window.OneSignal.Notifications?.addEventListener("permissionChange", (granted: boolean) => {
          if (!cancelled) {
            setIsSubscribed(granted);
            setPermission(granted ? "granted" : "denied");
          }
        });
      }
    };

    setup();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Logout OneSignal when user logs out
  useEffect(() => {
    if (!user) {
      removeExternalUserId();
      setIsSubscribed(false);
    }
  }, [user]);

  const subscribe = useCallback(async () => {
    if (!user || !isSupported) return false;

    setIsLoading(true);
    setDebugInfo([]);
    try {
      addDebug("Solicitando permissão OneSignal...");

      const granted = await optInPush();
      setPermission(getPermissionState());

      if (granted) {
        await setExternalUserId(user.id);
        setIsSubscribed(true);
        addDebug("✅ Push ativado com OneSignal!");
        toast.success("Notificações push ativadas!");
        return true;
      } else {
        addDebug("❌ Permissão negada");
        toast.error("Permissão de notificação negada");
        return false;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "erro desconhecido";
      console.error("Push subscription error:", e);
      addDebug(`❌ Erro: ${msg}`);
      toast.error("Erro ao ativar notificações push: " + msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported, addDebug]);

  const unsubscribe = useCallback(async () => {
    if (!user || !isSupported) return;

    setIsLoading(true);
    try {
      await optOutPush();
      setIsSubscribed(false);
      toast.success("Notificações push desativadas");
    } catch (e) {
      console.error("Push unsubscribe error:", e);
      toast.error("Erro ao desativar notificações push");
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    canFetchToken: true,
    subscribe,
    unsubscribe,
    debugInfo,
  };
}

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  initOneSignal,
  loginOneSignal,
  logoutOneSignal,
  isPushSupported,
  getPermissionState,
  requestPushPermission,
  getDiagnostics,
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
    setDebugInfo((prev) => [...prev.slice(-29), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);

  // Check support
  useEffect(() => {
    const supported = isPushSupported();
    setIsSupported(supported);
    if (supported) {
      setPermission(getPermissionState());
    }
  }, []);

  // Initialize and login when user is available
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const setup = async () => {
      addDebug("Inicializando OneSignal...");
      await initOneSignal();
      if (cancelled) return;

      addDebug("✅ SDK inicializado, fazendo login...");
      await loginOneSignal(user.id);

      // Check subscription state
      if (window.OneSignal) {
        const pushSub = window.OneSignal.User?.PushSubscription;
        const perm = window.OneSignal.Notifications?.permission;

        if (!cancelled) {
          const hasToken = !!pushSub?.token;
          setIsSubscribed(perm === true && hasToken);
          setPermission(getPermissionState());
          addDebug(`Estado: perm=${perm}, token=${hasToken ? "sim" : "não"}, optedIn=${pushSub?.optedIn}`);
        }

        // Listen for subscription changes
        window.OneSignal.User?.PushSubscription?.addEventListener("change", (event: any) => {
          if (!cancelled) {
            const current = event.current;
            addDebug(`Subscription mudou: optedIn=${current?.optedIn}, token=${current?.token ? "sim" : "não"}`);
            setIsSubscribed(current?.optedIn === true && !!current?.token);
          }
        });

        window.OneSignal.Notifications?.addEventListener("permissionChange", (granted: boolean) => {
          if (!cancelled) {
            setPermission(granted ? "granted" : "denied");
            addDebug(`Permissão mudou: ${granted}`);
          }
        });
      }
    };

    setup();
    return () => { cancelled = true; };
  }, [user, addDebug]);

  // Logout when user signs out
  useEffect(() => {
    if (!user) {
      logoutOneSignal();
      setIsSubscribed(false);
    }
  }, [user]);

  const subscribe = useCallback(async () => {
    if (!user || !isSupported) return false;

    setIsLoading(true);
    try {
      addDebug("Solicitando permissão...");
      await initOneSignal();

      const granted = await requestPushPermission();
      setPermission(getPermissionState());

      if (granted) {
        await loginOneSignal(user.id);
        await new Promise(r => setTimeout(r, 2000));

        const diag = getDiagnostics();
        addDebug(`Diagnóstico: ${JSON.stringify(diag)}`);

        const hasToken = !!diag.pushToken;
        setIsSubscribed(hasToken);

        if (hasToken) {
          addDebug("✅ Push ativado com token!");
          toast.success("Notificações push ativadas!");
        } else {
          addDebug("⚠️ Permissão OK mas sem token");
          toast.warning("Permissão concedida, mas registro pendente. Recarregue a página.");
        }
        return hasToken;
      } else {
        addDebug("❌ Permissão negada");
        toast.error("Permissão de notificação negada");
        return false;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "erro desconhecido";
      addDebug(`❌ Erro: ${msg}`);
      toast.error("Erro ao ativar push: " + msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported, addDebug]);

  const unsubscribe = useCallback(async () => {
    if (!user || !isSupported) return;

    setIsLoading(true);
    try {
      await logoutOneSignal();
      setIsSubscribed(false);
      toast.success("Notificações push desativadas");
    } catch (e) {
      console.error("Push unsubscribe error:", e);
      toast.error("Erro ao desativar push");
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

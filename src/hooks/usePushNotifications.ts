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

  // Initialize OneSignal and set external user ID
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const setup = async () => {
      addDebug("Inicializando OneSignal...");
      const ok = await initOneSignal();
      if (cancelled) return;
      
      if (!ok) {
        addDebug("❌ Falha ao inicializar OneSignal SDK");
        return;
      }
      
      addDebug("✅ SDK inicializado, fazendo login...");
      await setExternalUserId(user.id);

      // Check subscription state using PushSubscription API
      if (window.OneSignal) {
        const pushSub = window.OneSignal.User?.PushSubscription;
        const perm = window.OneSignal.Notifications?.permission;
        
        if (!cancelled) {
          // A user is truly subscribed only if they have a push token
          const hasToken = !!pushSub?.token;
          const optedIn = pushSub?.optedIn === true;
          setIsSubscribed(perm === true && hasToken);
          setPermission(getPermissionState());
          
          addDebug(`Estado: perm=${perm}, token=${hasToken ? "sim" : "não"}, optedIn=${optedIn}`);
        }

        // Listen for subscription changes
        window.OneSignal.User?.PushSubscription?.addEventListener("change", (event: any) => {
          if (!cancelled) {
            const current = event.current;
            addDebug(`Subscription mudou: optedIn=${current?.optedIn}, token=${current?.token ? "sim" : "não"}`);
            setIsSubscribed(current?.optedIn === true && !!current?.token);
          }
        });

        // Listen for permission changes
        window.OneSignal.Notifications?.addEventListener("permissionChange", (granted: boolean) => {
          if (!cancelled) {
            setPermission(granted ? "granted" : "denied");
            addDebug(`Permissão mudou: ${granted}`);
          }
        });
      }
    };

    setup();

    return () => {
      cancelled = true;
    };
  }, [user, addDebug]);

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
    try {
      addDebug("Solicitando permissão OneSignal...");
      
      // Ensure SDK is initialized first
      const sdkOk = await initOneSignal();
      if (!sdkOk) {
        addDebug("❌ SDK não inicializou");
        toast.error("Erro ao inicializar push notifications");
        return false;
      }

      const granted = await optInPush();
      setPermission(getPermissionState());

      if (granted) {
        await setExternalUserId(user.id);
        
        // Wait a moment for the push subscription to be created
        await new Promise(r => setTimeout(r, 2000));
        
        const diag = getDiagnostics();
        addDebug(`Diagnóstico: ${JSON.stringify(diag)}`);
        
        const hasToken = !!diag.pushToken;
        setIsSubscribed(hasToken);
        
        if (hasToken) {
          addDebug("✅ Push ativado com token!");
          toast.success("Notificações push ativadas!");
        } else {
          addDebug("⚠️ Permissão OK mas sem token — pode haver conflito de SW");
          toast.warning("Permissão concedida, mas registro pode estar pendente. Recarregue a página.");
        }
        return hasToken;
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

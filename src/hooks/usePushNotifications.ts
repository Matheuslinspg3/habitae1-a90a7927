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
      addDebug("Inicializando OneSignal via Deferred...");
      const ready = await initOneSignal();
      if (cancelled || !ready) {
        addDebug(ready ? "Cancelado" : "❌ SDK não ficou pronto");
        return;
      }

      addDebug("✅ SDK pronto, fazendo login...");
      await loginOneSignal(user.id);
      if (cancelled) return;

      // Check subscription state after login
      if (window.OneSignal) {
        const pushSub = window.OneSignal.User?.PushSubscription;
        const perm = window.OneSignal.Notifications?.permission;
        const hasToken = !!pushSub?.token;
        
        setIsSubscribed(perm === true && hasToken);
        setPermission(getPermissionState());
        addDebug(`Estado: perm=${perm}, token=${hasToken ? "sim" : "não"}, optedIn=${pushSub?.optedIn}`);

        // Listen for subscription changes
        try {
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
        } catch (e) {
          addDebug(`Erro ao registrar listeners: ${e}`);
        }
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
      addDebug("Inicializando OneSignal...");
      const ready = await initOneSignal();
      if (!ready) {
        addDebug("❌ SDK não ficou pronto");
        toast.error("Serviço de notificações indisponível. Tente recarregar a página.");
        return false;
      }

      // Check if permission is already granted
      const currentPermission = Notification.permission;
      addDebug(`Permissão atual: ${currentPermission}`);

      if (currentPermission === "granted") {
        addDebug("Permissão já concedida, registrando dispositivo...");
      } else {
        addDebug("Solicitando permissão...");
      }

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
          // Even without token yet, if permission is granted we're good
          if (Notification.permission === "granted") {
            setIsSubscribed(true);
            addDebug("✅ Permissão OK, token pode levar alguns segundos");
            toast.success("Notificações push ativadas!");
          } else {
            addDebug("⚠️ Permissão OK mas sem token");
            toast.warning("Permissão concedida, mas registro pendente. Recarregue a página.");
          }
        }
        return true;
      } else {
        const finalPerm = Notification.permission;
        addDebug(`❌ Resultado: granted=${granted}, permission=${finalPerm}`);
        if (finalPerm === "denied") {
          toast.error("Permissão de notificação bloqueada. Verifique as configurações do navegador.");
        } else {
          toast.error("Não foi possível ativar notificações. Tente novamente.");
        }
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

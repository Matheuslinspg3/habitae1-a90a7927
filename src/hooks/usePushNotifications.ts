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
  syncOneSignalDeviceRegistration,
  getOneSignalRuntimeBlockReason,
} from "@/lib/onesignal";
import { toast } from "sonner";

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [canFetchToken, setCanFetchToken] = useState(true);

  const addDebug = useCallback((msg: string) => {
    console.log("[Push]", msg);
    setDebugInfo((prev) => [...prev.slice(-29), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);

  useEffect(() => {
    const supported = isPushSupported();
    setIsSupported(supported);
    if (supported) {
      setPermission(getPermissionState());
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const setup = async () => {
      addDebug("Inicializando OneSignal via Deferred...");
      const blockReason = getOneSignalRuntimeBlockReason();
      if (blockReason) {
        addDebug(`⚠️ Ambiente bloqueado para push: ${blockReason}`);
        return;
      }

      const ready = await initOneSignal();
      if (cancelled || !ready) {
        addDebug(ready ? "Cancelado" : "❌ SDK não ficou pronto");
        return;
      }

      addDebug("✅ SDK pronto, fazendo login...");
      await loginOneSignal(user.id);
      if (cancelled) return;

      if (window.OneSignal) {
        const pushSub = window.OneSignal.User?.PushSubscription;
        const perm = window.OneSignal.Notifications?.permission;
        const hasToken = !!pushSub?.token;

        if (perm === true && pushSub?.id) {
          await syncOneSignalDeviceRegistration();
        }

        setCanFetchToken(hasToken);
        setIsSubscribed(perm === true && hasToken);
        setPermission(getPermissionState());
        addDebug(`Estado: perm=${perm}, token=${hasToken ? "sim" : "não"}, optedIn=${pushSub?.optedIn}`);

        try {
          window.OneSignal.User?.PushSubscription?.addEventListener("change", (event: any) => {
            if (!cancelled) {
              const current = event.current;
              const hasTokenNow = !!current?.token;
              addDebug(`Subscription mudou: optedIn=${current?.optedIn}, token=${hasTokenNow ? "sim" : "não"}`);
              setCanFetchToken(hasTokenNow);
              setIsSubscribed(current?.optedIn === true && hasTokenNow);
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
    return () => {
      cancelled = true;
    };
  }, [user, addDebug]);

  useEffect(() => {
    if (!user) {
      logoutOneSignal();
      setCanFetchToken(false);
      setIsSubscribed(false);
    }
  }, [user]);

  const subscribe = useCallback(async () => {
    if (!user || !isSupported) return false;

    setIsLoading(true);
    try {
      addDebug("Inicializando OneSignal...");
      const blockReason = getOneSignalRuntimeBlockReason();
      if (blockReason) {
        addDebug(`❌ Ambiente bloqueado: ${blockReason}`);
        toast.error(
          blockReason === "iframe"
            ? "Notificações push não funcionam no preview do Lovable (iframe). Teste na URL publicada."
            : blockReason === "ios-standalone-required"
              ? "No iPhone/iPad, push só funciona com o app instalado na Tela de Início (modo PWA)."
              : "Push exige HTTPS e contexto seguro. Abra o site publicado em https.",
        );
        return false;
      }

      const ready = await initOneSignal();
      if (!ready) {
        addDebug("❌ SDK não ficou pronto");
        toast.error("Serviço de notificações indisponível. Tente recarregar a página.");
        return false;
      }

      const currentPermission = Notification.permission;
      addDebug(`Permissão atual: ${currentPermission}`);
      addDebug(currentPermission === "granted" ? "Permissão já concedida, registrando dispositivo..." : "Solicitando permissão...");

      const granted = await requestPushPermission();
      setPermission(getPermissionState());

      if (granted) {
        await loginOneSignal(user.id);

        let diag = getDiagnostics();
        let hasToken = !!diag.pushToken;
        let attempts = 0;

        while (!hasToken && attempts < 10) {
          attempts += 1;
          await new Promise((r) => setTimeout(r, 1000));
          diag = getDiagnostics();
          hasToken = !!diag.pushToken;
          addDebug(`Aguardando token (${attempts}/10): ${hasToken ? "ok" : "pendente"}`);
        }

        addDebug(`Diagnóstico final: ${JSON.stringify(diag)}`);

        setCanFetchToken(hasToken);
        setIsSubscribed(hasToken);

        if (hasToken) {
          addDebug("✅ Push ativado com token!");
          toast.success("Notificações push ativadas!");
        } else if (Notification.permission === "granted") {
          addDebug("⚠️ Permissão concedida mas ainda sem token");
          toast.warning("Permissão concedida, mas o token push não foi gerado. Tente novamente em alguns segundos.");
        } else {
          addDebug("⚠️ Permissão não concedida");
          toast.warning("Permissão não concedida. Verifique as configurações do navegador.");
        }
        return hasToken;
      }

      const finalPerm = Notification.permission;
      addDebug(`❌ Resultado: granted=${granted}, permission=${finalPerm}`);
      if (finalPerm === "denied") {
        toast.error("Permissão de notificação bloqueada. Verifique as configurações do navegador.");
      } else {
        toast.error("Não foi possível ativar notificações. Tente novamente.");
      }
      return false;
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
      setCanFetchToken(false);
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
    canFetchToken,
    subscribe,
    unsubscribe,
    debugInfo,
  };
}

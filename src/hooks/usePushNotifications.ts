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
  ensurePushSubscriptionReady,
  getOneSignalRuntimeBlockReason,
  getOneSignalInitFailure,
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
        const failure = getOneSignalInitFailure();
        addDebug(`❌ SDK não ficou pronto${failure.reason ? ` (${failure.reason})` : ""}`);
        return;
      }

      addDebug("✅ SDK pronto, fazendo login...");
      await loginOneSignal(user.id);
      if (cancelled) return;

      if (window.OneSignal) {
        const pushSub = window.OneSignal.User?.PushSubscription;
        const perm = window.OneSignal.Notifications?.permission;
        const hasId = !!pushSub?.id;
        const hasToken = !!pushSub?.token;
        const hasSubscription = hasId || hasToken;

        if (perm === true && hasId) {
          await syncOneSignalDeviceRegistration();
        }

        setCanFetchToken(hasToken);
        setIsSubscribed(perm === true && hasSubscription);
        setPermission(getPermissionState());
        addDebug(`Estado: perm=${perm}, id=${hasId ? "sim" : "não"}, token=${hasToken ? "sim" : "não"}, optedIn=${pushSub?.optedIn}`);

        try {
          window.OneSignal.User?.PushSubscription?.addEventListener("change", (event: any) => {
            if (!cancelled) {
              const current = event.current;
              const hasIdNow = !!current?.id;
              const hasTokenNow = !!current?.token;
              const hasSubscriptionNow = hasIdNow || hasTokenNow;
              addDebug(`Subscription mudou: optedIn=${current?.optedIn}, id=${hasIdNow ? "sim" : "não"}, token=${hasTokenNow ? "sim" : "não"}`);
              setCanFetchToken(hasTokenNow);
              setIsSubscribed(current?.optedIn === true && hasSubscriptionNow);
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
        const failure = getOneSignalInitFailure();
        addDebug(`❌ SDK não ficou pronto${failure.reason ? ` (${failure.reason})` : ""}`);

        if (failure.reason === "domain-mismatch") {
          toast.error("Push bloqueado: o OneSignal deste app está configurado para outro domínio. Atualize o Site URL/Allowed Origins no OneSignal para portadocorretor.com.br.");
        } else if (failure.reason === "service-worker-invalid-state") {
          toast.error("Conflito de Service Worker detectado. Recarregue a página e tente ativar novamente.");
        } else {
          toast.error("Serviço de notificações indisponível. Tente recarregar a página.");
        }
        return false;
      }

      const currentPermission = Notification.permission;
      addDebug(`Permissão atual: ${currentPermission}`);
      addDebug(currentPermission === "granted" ? "Permissão já concedida, registrando dispositivo..." : "Solicitando permissão...");

      const granted = await requestPushPermission();
      setPermission(getPermissionState());

      if (granted) {
        await loginOneSignal(user.id);

        const snapshot = await ensurePushSubscriptionReady(15000);
        const hasId = !!snapshot.id;
        const hasToken = !!snapshot.token;
        const hasSubscription = hasId || hasToken;

        const diag = getDiagnostics();
        addDebug(`Aguardado subscription: id=${hasId ? "ok" : "pendente"}, token=${hasToken ? "ok" : "pendente"}`);
        addDebug(`Diagnóstico final: ${JSON.stringify(diag)}`);

        if (hasId) {
          await syncOneSignalDeviceRegistration();
        }

        setCanFetchToken(hasToken);
        setIsSubscribed(hasSubscription);

        if (hasSubscription) {
          addDebug(hasToken ? "✅ Push ativado com token!" : "✅ Push ativado com subscription_id (token não exposto)");
          toast.success("Notificações push ativadas!");
        } else if (Notification.permission === "granted") {
          addDebug("⚠️ Permissão concedida mas ainda sem subscription id/token");
          toast.warning("Permissão concedida, mas a inscrição push ainda não foi concluída. Recarregue a página e tente novamente.");
        } else {
          addDebug("⚠️ Permissão não concedida");
          toast.warning("Permissão não concedida. Verifique as configurações do navegador.");
        }
        return hasSubscription;
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

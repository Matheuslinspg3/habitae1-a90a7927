import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Send, Loader2, CheckCircle2, XCircle, Bug, Monitor, Search } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PushTestCard() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe, debugInfo } = usePushNotifications();
  const [isSending, setIsSending] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [localDebug, setLocalDebug] = useState<string[]>([]);

  const addDebug = useCallback((msg: string) => {
    console.log("[PushTest]", msg);
    setLocalDebug((prev) => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${msg}`]);
  }, []);

  const checkSW = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration(
        "/firebase-cloud-messaging-push-scope/"
      );
      if (reg?.active) {
        toast.success(`SW ativo (state: ${reg.active.state}, scope: ${reg.scope})`);
      } else if (reg) {
        toast.warning(`SW encontrado mas não ativo (installing: ${reg.installing?.state}, waiting: ${reg.waiting?.state})`);
      } else {
        toast.error("SW Firebase NÃO encontrado. Reative o push.");
      }
    } catch (e: any) {
      toast.error("Erro ao verificar SW: " + e.message);
    }
  };

  const testLocalNotification = () => {
    if (Notification.permission === "granted") {
      new Notification("🔔 Teste Local Habitae", {
        body: "Se você está vendo isso, o navegador permite notificações!",
        icon: "/pwa-192x192.png",
      });
      toast.success("Notificação local enviada - verifique se apareceu");
    } else {
      toast.error(`Permissão: ${Notification.permission}`);
    }
  };

  const handleTestPush = async () => {
    if (!user) return;
    setIsSending(true);
    addDebug("Enviando push de teste...");
    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          user_id: user.id,
          title: "Teste Habitae",
          message: "Esta é uma notificação de teste. Se você está vendo isso, o push está funcionando!",
          notification_type: "test",
        },
      });

      addDebug(`Resultado: ${JSON.stringify(data || error)}`);

      if (error) throw error;

      if (data?.sent > 0) {
        toast.success(`Push enviado! (${data.sent} dispositivo${data.sent > 1 ? "s" : ""})`);
      } else if (data?.staleRemoved > 0) {
        toast.warning("Todos os tokens estavam expirados. Desative e reative as notificações push.");
        addDebug("Tokens expirados removidos: " + data.staleRemoved);
      } else {
        toast.warning("Nenhum dispositivo encontrado. Ative as notificações primeiro.");
      }
    } catch (e: any) {
      console.error("Test push error:", e);
      const msg = e.message || "erro desconhecido";
      if (msg.includes("FIREBASE_SERVICE_ACCOUNT_KEY")) {
        toast.error("FIREBASE_SERVICE_ACCOUNT_KEY não configurada nos Secrets do Supabase");
        addDebug("Falta secret: FIREBASE_SERVICE_ACCOUNT_KEY");
      } else if (msg.includes("APP_URL")) {
        toast.error("APP_URL não configurada nos Secrets do Supabase");
        addDebug("Falta secret: APP_URL");
      } else {
        toast.error("Erro ao enviar push: " + msg);
      }
      addDebug(`Erro completo: ${msg}`);
    } finally {
      setIsSending(false);
    }
  };

  const checkSubscriptions = async () => {
    if (!user) return;
    addDebug("Consultando subscriptions...");
    try {
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id, fcm_token, created_at, device_info")
        .eq("user_id", user.id);

      if (error) {
        addDebug(`Erro ao consultar subscriptions: ${error.message}`);
        toast.error("Erro ao verificar subscriptions");
        return;
      }

      addDebug(`${data.length} subscription(s) encontrada(s)`);
      data.forEach((sub, i) => {
        addDebug(`  ${i + 1}. Token: ${sub.fcm_token.substring(0, 20)}... | Criado: ${new Date(sub.created_at).toLocaleString()}`);
      });

      if (data.length === 0) {
        toast.warning("Nenhuma subscription encontrada. Ative as notificações push primeiro.");
      } else {
        toast.success(`${data.length} subscription(s) ativa(s)`);
      }
    } catch (e: any) {
      addDebug(`Erro: ${e.message}`);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Push Notifications
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 w-6 p-0"
            onClick={() => setShowDebug(!showDebug)}
          >
            <Bug className="h-3 w-3" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={isSupported ? "default" : "destructive"} className="gap-1">
            {isSupported ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {isSupported ? "Suportado" : "Não suportado"}
          </Badge>
          <Badge variant={permission === "granted" ? "default" : "secondary"} className="gap-1">
            Permissão: {permission}
          </Badge>
          <Badge variant={isSubscribed ? "default" : "outline"} className="gap-1">
            {isSubscribed ? "Inscrito" : "Não inscrito"}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {!isSubscribed ? (
            <Button
              onClick={subscribe}
              disabled={isLoading || !isSupported}
              size="sm"
              className="gap-2"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              Ativar Push
            </Button>
          ) : (
            <Button
              onClick={unsubscribe}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
              Desativar Push
            </Button>
          )}

          <Button
            onClick={checkSW}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Bug className="h-4 w-4" />
            Verificar SW
          </Button>

          <Button
            onClick={testLocalNotification}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Monitor className="h-4 w-4" />
            Teste Local
          </Button>

          <Button
            onClick={checkSubscriptions}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Search className="h-4 w-4" />
            Verificar Subscriptions
          </Button>

          <Button
            onClick={handleTestPush}
            disabled={isSending || !isSubscribed}
            variant="gold"
            size="sm"
            className="gap-2"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar Push de Teste
          </Button>
        </div>

        {!isSubscribed && (
          <p className="text-xs text-muted-foreground">
            Ative as notificações push primeiro para poder enviar um teste.
          </p>
        )}

        {/* Version */}
        <p className="text-xs text-muted-foreground font-mono">
          Push v1.3 — build {new Date().toISOString().slice(0, 16)}
        </p>

        {/* Debug Info */}
        {showDebug && (debugInfo.length > 0 || localDebug.length > 0) && (
          <div className="rounded-md bg-muted p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">Debug Log:</p>
            {[...debugInfo, ...localDebug].map((line, i) => (
              <p key={i} className="text-xs font-mono text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

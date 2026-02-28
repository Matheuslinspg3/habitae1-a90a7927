import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Send, Loader2, CheckCircle2, XCircle, Bug, Monitor, RefreshCw } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getDiagnostics } from "@/lib/onesignal";
import { toast } from "sonner";
import { getPushErrorDetails, getPushErrorMessage } from "@/lib/pushErrors";

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

  const runDiagnostics = useCallback(() => {
    const diag = getDiagnostics();
    addDebug(`=== DIAGNÓSTICO ===`);
    Object.entries(diag).forEach(([key, value]) => {
      addDebug(`  ${key}: ${JSON.stringify(value)}`);
    });
    
    // Also check service worker registrations
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        addDebug(`Service Workers registrados: ${regs.length}`);
        regs.forEach((reg, i) => {
          addDebug(`  SW[${i}]: scope=${reg.scope}, active=${!!reg.active}, waiting=${!!reg.waiting}`);
        });
      });
    }
  }, [addDebug]);

  const testLocalNotification = () => {
    if (Notification.permission === "granted") {
      new Notification("🔔 Teste Local", {
        body: "Se você está vendo isso, o navegador permite notificações!",
        icon: "/pwa-192x192.png",
      });
      toast.success("Notificação local enviada");
    } else {
      toast.error(`Permissão: ${Notification.permission}`);
    }
  };

  const handleTestPush = async () => {
    if (!user) return;
    setIsSending(true);
    addDebug("Enviando push de teste via OneSignal...");
    try {
      const { data, error } = await supabase.functions.invoke("notifications-test", {
        body: {
          title: "🔔 Teste Push",
          message: "Esta é uma notificação de teste via OneSignal!",
          userId: user.id,
        },
      });

      addDebug(`Resultado: ${JSON.stringify(data || error)}`);

      if (error) throw error;

      if (data?.ok && data?.recipientsCount > 0) {
        toast.success(`Push enviado para ${data.recipientsCount} dispositivo(s)!`);
      } else {
        toast.warning("Usuário sem dispositivos inscritos no OneSignal.");
        addDebug("⚠️ sent=0 — Verifique se o token existe no diagnóstico");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "erro desconhecido";
      console.error("Test push error:", e);
      if (msg.includes("ONESIGNAL")) {
        toast.error("Credenciais OneSignal não configuradas nos Secrets");
        addDebug("Falta secret OneSignal");
      } else {
        const details = getPushErrorDetails(e);
        toast.error(getPushErrorMessage(e));
        if (details.hint) addDebug(`Dica: ${details.hint}`);
        toast.error(getPushErrorMessage(e));
      }
      addDebug(`Erro: ${msg}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Push Notifications (OneSignal)
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
        <div className="flex flex-wrap gap-2">
          <Badge variant={isSupported ? "default" : "destructive"} className="gap-1">
            {isSupported ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {isSupported ? "Suportado" : "Não suportado"}
          </Badge>
          <Badge variant={permission === "granted" ? "default" : "secondary"} className="gap-1">
            Permissão: {permission}
          </Badge>
          <Badge variant={isSubscribed ? "default" : "outline"} className="gap-1">
            {isSubscribed ? "✅ Inscrito (token)" : "❌ Sem token"}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isSubscribed ? (
            <Button onClick={subscribe} disabled={isLoading || !isSupported} size="sm" className="gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              Ativar Push
            </Button>
          ) : (
            <Button onClick={unsubscribe} disabled={isLoading} variant="outline" size="sm" className="gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
              Desativar Push
            </Button>
          )}

          <Button onClick={testLocalNotification} variant="outline" size="sm" className="gap-2">
            <Monitor className="h-4 w-4" />
            Teste Local
          </Button>

          <Button onClick={runDiagnostics} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Diagnóstico
          </Button>

          <Button
            onClick={handleTestPush}
            disabled={isSending || !isSubscribed}
            variant="default"
            size="sm"
            className="gap-2"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar Push de Teste
          </Button>
        </div>

        {!isSubscribed && permission === "granted" && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⚠️ Permissão concedida mas sem token push. Clique "Diagnóstico" e verifique se o OneSignal SDK está inicializado.
          </p>
        )}

        {!isSubscribed && permission !== "granted" && (
          <p className="text-xs text-muted-foreground">
            Ative as notificações push primeiro para poder enviar um teste.
          </p>
        )}

        <p className="text-xs text-muted-foreground font-mono">
          Push v3.0 (OneSignal scope isolado) — TTL 7 dias
        </p>

        {showDebug && (debugInfo.length > 0 || localDebug.length > 0) && (
          <div className="rounded-md bg-muted p-3 space-y-1 max-h-64 overflow-y-auto">
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

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Send, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PushTestCard() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();
  const [isSending, setIsSending] = useState(false);

  const handleTestPush = async () => {
    if (!user) return;
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          user_id: user.id,
          title: "🔔 Teste Habitae",
          message: "Esta é uma notificação de teste. Se você está vendo isso, o push está funcionando!",
          notification_type: "test",
        },
      });

      if (error) throw error;

      if (data?.sent > 0) {
        toast.success(`Push enviado com sucesso! (${data.sent} dispositivo${data.sent > 1 ? "s" : ""})`);
      } else {
        toast.warning("Nenhum dispositivo registrado. Ative as notificações primeiro.");
      }
    } catch (e: any) {
      console.error("Test push error:", e);
      toast.error("Erro ao enviar push: " + (e.message || "erro desconhecido"));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Push Notifications
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
      </CardContent>
    </Card>
  );
}

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, Link2, Webhook as WebhookIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { useRDStationSettings } from "@/hooks/useRDStationSettings";

export default function RDWebhookTab() {
  const { settings, webhookLogs, orgId, queryClient } = useRDStationSettings();

  const regenerateWebhook = useMutation({
    mutationFn: async () => {
      if (!settings?.id) return;
      const newSecret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const { error } = await supabase
        .from("rd_station_settings")
        .update({ webhook_secret: newSecret })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rd-station-settings"] });
      toast.success("Webhook regenerado! Atualize a URL no RD Station.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const webhookUrl = settings
    ? `https://api.portadocorretor.com.br/rd-station-webhook?org=${orgId?.slice(0, 8)}&token=${settings.webhook_secret}`
    : "";

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada!");
  };

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <WebhookIcon className="h-4 w-4" />
            URL do Webhook
          </CardTitle>
          <CardDescription>
            Cole esta URL no RD Station em Integrações → Webhooks → Nova integração.
            Os leads serão recebidos automaticamente no CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Link2 className="h-3.5 w-3.5" />
              URL do Webhook
            </Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="text-xs font-mono" />
              <Button variant="outline" size="icon" onClick={copyWebhookUrl} title="Copiar URL">
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (confirm("Tem certeza? A URL atual deixará de funcionar e você precisará atualizar no RD Station.")) {
                    regenerateWebhook.mutate();
                  }
                }}
                disabled={regenerateWebhook.isPending}
                title="Regenerar token"
              >
                {regenerateWebhook.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Últimos Webhooks Recebidos
          </CardTitle>
          <CardDescription>
            Histórico dos últimos leads recebidos do RD Station via webhook.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {webhookLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum webhook recebido ainda. Configure o webhook no RD Station para começar.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {webhookLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {(log.payload as any)?.name || (log.payload as any)?.email || "Lead"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge
                    variant={
                      log.status === "created" ? "default" :
                      log.status === "duplicate" ? "secondary" :
                      log.status === "error" ? "destructive" : "outline"
                    }
                  >
                    {log.status === "created" ? "Criado" :
                     log.status === "duplicate" ? "Duplicado" :
                     log.status === "error" ? "Erro" :
                     log.status === "received_not_sent" ? "Recebido" : log.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

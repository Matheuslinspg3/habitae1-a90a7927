import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLeadStages } from "@/hooks/useLeadStages";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Loader2, Copy, Link2, BarChart3, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function RDStationSettingsContent() {
  const { profile } = useAuth();
  const { leadStages } = useLeadStages();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: settings, isLoading } = useQuery({
    queryKey: ["rd-station-settings", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("rd_station_settings")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: webhookLogs = [] } = useQuery({
    queryKey: ["rd-station-logs", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("rd_station_webhook_logs")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const [isActive, setIsActive] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const [stageId, setStageId] = useState("");
  const [defaultSource, setDefaultSource] = useState("RD Station");

  useEffect(() => {
    if (settings) {
      setIsActive(settings.is_active);
      setAutoSend(settings.auto_send_to_crm);
      setStageId(settings.default_stage_id || "");
      setDefaultSource(settings.default_source || "RD Station");
    }
  }, [settings]);

  const createSettings = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Sem organização");
      const { error } = await supabase
        .from("rd_station_settings")
        .insert({ organization_id: orgId, is_active: true, auto_send_to_crm: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rd-station-settings"] });
      toast.success("Integração RD Station ativada!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateSettings = useMutation({
    mutationFn: async () => {
      if (!settings?.id) return;
      const { error } = await supabase
        .from("rd_station_settings")
        .update({
          is_active: isActive,
          auto_send_to_crm: autoSend,
          default_stage_id: stageId || null,
          default_source: defaultSource,
        })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rd-station-settings"] });
      toast.success("Configurações salvas!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const webhookUrl = settings
    ? `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/rd-station-webhook?org_id=${orgId}&secret=${settings.webhook_secret}`
    : "";

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL copiada!");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              RD Station Marketing
            </CardTitle>
            <CardDescription>
              Receba leads automaticamente do RD Station Marketing no seu CRM.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure o RD Station para enviar leads por webhook sempre que uma conversão ocorrer. 
              Os leads serão criados automaticamente no CRM.
            </p>
            <Button onClick={() => createSettings.mutate()} disabled={createSettings.isPending}>
              {createSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ativar Integração
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status & Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            RD Station Marketing
          </CardTitle>
          <CardDescription>
            Configure o webhook no RD Station para receber leads automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Integração ativa</Label>
            {isActive ? (
              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Ativa</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Inativa</Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Link2 className="h-3.5 w-3.5" />
              URL do Webhook
            </Label>
            <p className="text-xs text-muted-foreground">
              Cole esta URL no RD Station em Integrações → Webhooks → Nova integração.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={webhookUrl}
                className="text-xs font-mono"
              />
              <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CRM Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurações do CRM</CardTitle>
          <CardDescription>
            Como os leads recebidos devem ser tratados no CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={autoSend} onCheckedChange={setAutoSend} />
            <Label>Criar lead automaticamente no CRM</Label>
          </div>

          {autoSend && (
            <>
              <div className="space-y-2 max-w-sm">
                <Label>Estágio inicial do CRM</Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um estágio..." /></SelectTrigger>
                  <SelectContent>
                    {leadStages.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 max-w-sm">
                <Label>Origem do lead</Label>
                <Input
                  value={defaultSource}
                  onChange={(e) => setDefaultSource(e.target.value)}
                  placeholder="RD Station"
                />
              </div>
            </>
          )}

          <Button onClick={() => updateSettings.mutate()} disabled={updateSettings.isPending}>
            {updateSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Configurações
          </Button>
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
            Histórico dos últimos leads recebidos do RD Station.
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

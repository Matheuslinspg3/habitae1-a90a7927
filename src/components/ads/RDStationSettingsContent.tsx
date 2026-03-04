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
import { CheckCircle2, XCircle, Loader2, Copy, Link2, BarChart3, RefreshCw, Key, Webhook, Download } from "lucide-react";
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
  const [apiPublicKey, setApiPublicKey] = useState("");
  const [apiPrivateKey, setApiPrivateKey] = useState("");
  const [integrationMode, setIntegrationMode] = useState<"api" | "webhook">("webhook");

  useEffect(() => {
    if (settings) {
      setIsActive(settings.is_active);
      setAutoSend(settings.auto_send_to_crm);
      setStageId(settings.default_stage_id || "");
      setDefaultSource(settings.default_source || "RD Station");
      setApiPublicKey(settings.api_public_key || "");
      setApiPrivateKey(settings.api_private_key || "");
      // Determine mode from saved data
      if (settings.api_public_key || settings.api_private_key) {
        setIntegrationMode("api");
      } else {
        setIntegrationMode("webhook");
      }
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
          api_public_key: apiPublicKey || null,
          api_private_key: apiPrivateKey || null,
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

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number; duplicates: number; errors: number } | null>(null);

  const handleSyncLeads = async () => {
    if (!apiPrivateKey && !settings?.api_private_key) {
      toast.error("Configure a chave privada de API antes de sincronizar.");
      return;
    }
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("rd-station-sync-leads");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSyncResult({ created: data.created, duplicates: data.duplicates, errors: data.errors });
      toast.success(`Sincronização concluída: ${data.created} leads criados, ${data.duplicates} duplicados.`);
      queryClient.invalidateQueries({ queryKey: ["rd-station-logs"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao sincronizar leads.");
    } finally {
      setIsSyncing(false);
    }
  };

  const webhookUrl = settings
    ? `https://api.portadocorretor.com.br/rd-station-webhook?org=${orgId?.slice(0, 8)}&token=${settings.webhook_secret}`
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
      {/* Status & Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            RD Station Marketing
          </CardTitle>
          <CardDescription>
            Escolha o modo de integração principal e configure as opções.
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

          {/* Mode selector */}
          <div className="space-y-2">
            <Label>Modo de integração principal</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIntegrationMode("api")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-colors ${
                  integrationMode === "api"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Key className="h-5 w-5" />
                <span className="font-medium">API</span>
                <span className="text-xs text-muted-foreground text-center">
                  Chaves de API do RD Station. Webhook fica opcional.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setIntegrationMode("webhook")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-colors ${
                  integrationMode === "webhook"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Webhook className="h-5 w-5" />
                <span className="font-medium">Webhook</span>
                <span className="text-xs text-muted-foreground text-center">
                  Receba leads via Webhook. API fica opcional.
                </span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys — shown first when mode=api */}
      {integrationMode === "api" && (<>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4" />
              Chaves de API
            </CardTitle>
            <CardDescription>
              Insira suas chaves do RD Station para sincronização de contatos e leads.
              Encontre suas chaves em RD Station → Conta → Integrações → Chaves de API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-md">
              <Label>Chave Pública (Public API Key)</Label>
              <Input
                value={apiPublicKey}
                onChange={(e) => setApiPublicKey(e.target.value)}
                placeholder="Sua chave pública do RD Station"
              />
            </div>
            <div className="space-y-2 max-w-md">
              <Label>Chave Privada (Private API Key)</Label>
              <Input
                type="password"
                value={apiPrivateKey}
                onChange={(e) => setApiPrivateKey(e.target.value)}
                placeholder="Sua chave privada do RD Station"
              />
              <p className="text-xs text-muted-foreground">
                A chave privada é armazenada de forma segura e nunca será exibida novamente após salvar.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sync Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4" />
              Sincronizar Leads
            </CardTitle>
            <CardDescription>
              Puxe todos os contatos do RD Station para o CRM via API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Busca contatos na API do RD Station, verifica duplicatas por email e cria os leads novos no CRM.
            </p>
            <Button onClick={handleSyncLeads} disabled={isSyncing}>
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Sincronizar Leads Agora
                </>
              )}
            </Button>
            {syncResult && (
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="default">{syncResult.created} criados</Badge>
                <Badge variant="secondary">{syncResult.duplicates} duplicados</Badge>
                {syncResult.errors > 0 && (
                  <Badge variant="destructive">{syncResult.errors} erros</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </>)}

      {/* Webhook URL — shown first when mode=webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Webhook {integrationMode === "api" && <Badge variant="outline" className="ml-1 text-xs">opcional</Badge>}
          </CardTitle>
          <CardDescription>
            {integrationMode === "webhook"
              ? "Cole esta URL no RD Station em Integrações → Webhooks → Nova integração."
              : "Opcionalmente, configure o webhook para também receber leads em tempo real."}
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

      {/* API Keys — shown after webhook when mode=webhook (optional) */}
      {integrationMode === "webhook" && (<>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4" />
              Chaves de API <Badge variant="outline" className="ml-1 text-xs">opcional</Badge>
            </CardTitle>
            <CardDescription>
              Opcionalmente, adicione chaves de API para sincronizar leads via API.
              Encontre suas chaves em RD Station → Conta → Integrações → Chaves de API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-md">
              <Label>Chave Pública (Public API Key)</Label>
              <Input
                value={apiPublicKey}
                onChange={(e) => setApiPublicKey(e.target.value)}
                placeholder="Sua chave pública do RD Station"
              />
            </div>
            <div className="space-y-2 max-w-md">
              <Label>Chave Privada (Private API Key)</Label>
              <Input
                type="password"
                value={apiPrivateKey}
                onChange={(e) => setApiPrivateKey(e.target.value)}
                placeholder="Sua chave privada do RD Station"
              />
              <p className="text-xs text-muted-foreground">
                A chave privada é armazenada de forma segura e nunca será exibida novamente após salvar.
              </p>
            </div>
            {(apiPrivateKey || settings?.api_private_key) && (
              <Button variant="outline" onClick={handleSyncLeads} disabled={isSyncing} className="mt-2">
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Sincronizar Leads via API
                  </>
                )}
              </Button>
            )}
            {syncResult && (
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="default">{syncResult.created} criados</Badge>
                <Badge variant="secondary">{syncResult.duplicates} duplicados</Badge>
                {syncResult.errors > 0 && (
                  <Badge variant="destructive">{syncResult.errors} erros</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </>)}

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

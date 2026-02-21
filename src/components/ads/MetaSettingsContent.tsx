import React, { useState } from "react";
import { useAdAccount, useAdSettings } from "@/hooks/useAdSettings";
import { useLeadStages } from "@/hooks/useLeadStages";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Zap } from "lucide-react";

export default function MetaSettingsContent() {
  const { account, isConnected, saveAccount, disconnectAccount, isSaving } = useAdAccount();
  const { settings, updateSettings, isSaving: isSavingSettings } = useAdSettings();
  const { leadStages } = useLeadStages();

  const [token, setToken] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [autoSend, setAutoSend] = useState(settings?.auto_send_to_crm ?? false);
  const [stageId, setStageId] = useState(settings?.crm_stage_id ?? "");

  React.useEffect(() => {
    if (settings) {
      setAutoSend(settings.auto_send_to_crm);
      setStageId(settings.crm_stage_id || "");
    }
  }, [settings]);

  const handleConnect = () => {
    if (!token.trim() || !adAccountId.trim()) return;
    saveAccount({ accessToken: token.trim(), adAccountId: adAccountId.trim() });
    setToken("");
  };

  const handleSaveAutomation = () => {
    updateSettings({ autoSendToCrm: autoSend, crmStageId: stageId || null });
  };

  return (
    <div className="space-y-6">
      {/* Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conectar Meta Ads</CardTitle>
          <CardDescription>Configure o acesso à sua conta de anúncios do Meta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            {isConnected ? (
              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Conectado</Badge>
            ) : (
              <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Desconectado</Badge>
            )}
          </div>

          {isConnected ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Conta: <strong>{account?.external_account_id}</strong>
              </p>
              <Button variant="destructive" size="sm" onClick={() => disconnectAccount()}>Desconectar</Button>
            </div>
          ) : (
            <div className="space-y-3 max-w-md">
              <div className="space-y-2">
                <Label>Access Token do Meta</Label>
                <Input type="password" placeholder="Cole o token aqui..." value={token} onChange={(e) => setToken(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Ad Account ID</Label>
                <Input placeholder="Ex: act_123456789" value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} />
              </div>
              <Button onClick={handleConnect} disabled={isSaving || !token || !adAccountId}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Conectar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Automation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Automação CRM</CardTitle>
          <CardDescription>Configure o envio automático de leads para o CRM.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={autoSend} onCheckedChange={setAutoSend} />
            <Label>Encaminhar automaticamente leads ao CRM</Label>
          </div>
          {autoSend && (
            <div className="space-y-2 max-w-sm">
              <Label>Estágio do CRM</Label>
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
          )}
          <Button onClick={handleSaveAutomation} disabled={isSavingSettings}>
            {isSavingSettings && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Automação
          </Button>
        </CardContent>
      </Card>

      {/* Sync buttons */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Sincronização</CardTitle>
            <CardDescription>Sincronize dados manualmente com o Meta Ads.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              A sincronização completa será realizada pelas funções de backend. Use os botões abaixo para disparar manualmente.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" disabled>
                <RefreshCw className="h-4 w-4 mr-2" /> Sincronizar Ads
              </Button>
              <Button variant="outline" size="sm" disabled>
                <RefreshCw className="h-4 w-4 mr-2" /> Sincronizar Estatísticas (30 dias)
              </Button>
              <Button variant="outline" size="sm" disabled>
                <RefreshCw className="h-4 w-4 mr-2" /> Backfill Leads (7 dias)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground italic">Os endpoints de sincronização serão habilitados após configuração do backend.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Loader2, Key, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useLeadStages } from "@/hooks/useLeadStages";
import { useRDStationSettings } from "@/hooks/useRDStationSettings";

export default function RDSettingsTab() {
  const { settings, isLoading, createSettings, updateSettings, queryClient } = useRDStationSettings();
  const { leadStages } = useLeadStages();

  const [isActive, setIsActive] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const [stageId, setStageId] = useState("");
  const [defaultSource, setDefaultSource] = useState("RD Station");
  const [apiPublicKey, setApiPublicKey] = useState("");
  const [apiPrivateKey, setApiPrivateKey] = useState("");

  useEffect(() => {
    if (settings) {
      setIsActive(settings.is_active);
      setAutoSend(settings.auto_send_to_crm);
      setStageId(settings.default_stage_id || "");
      setDefaultSource(settings.default_source || "RD Station");
      setApiPublicKey(settings.api_public_key || "");
      setApiPrivateKey(settings.api_private_key || "");
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate(
      {
        is_active: isActive,
        auto_send_to_crm: autoSend,
        default_stage_id: stageId || null,
        default_source: defaultSource,
        api_public_key: apiPublicKey || null,
        api_private_key: apiPrivateKey || null,
      },
      {
        onSuccess: () => toast.success("Configurações salvas!"),
        onError: (e: any) => toast.error(e.message),
      }
    );
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
            </p>
            <Button
              onClick={() => createSettings.mutate(undefined, {
                onSuccess: () => toast.success("Integração RD Station ativada!"),
                onError: (e: any) => toast.error(e.message),
              })}
              disabled={createSettings.isPending}
            >
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
      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Status da Integração
          </CardTitle>
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
        </CardContent>
      </Card>

      {/* Private Token (Conversions) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Chaves de API (Conversões)
          </CardTitle>
          <CardDescription>
            O Private Token permite enviar conversões do CRM para o RD Station (ex: quando um lead avança no funil).
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
              A chave privada é usada para enviar eventos de conversão ao RD Station.
            </p>
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

          <Button onClick={handleSave} disabled={updateSettings.isPending}>
            {updateSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

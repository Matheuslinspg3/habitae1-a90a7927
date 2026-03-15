import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, FlaskConical } from "lucide-react";
import { useAiBillingConfig, useUpdateBillingConfig } from "@/hooks/useAiBilling";
import { useToast } from "@/hooks/use-toast";

export function BillingConfigPanel() {
  const { data: config, isLoading } = useAiBillingConfig();
  const update = useUpdateBillingConfig();
  const { toast } = useToast();

  if (isLoading || !config) {
    return <Card><CardContent className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  const handleToggle = async (field: string, value: boolean) => {
    try {
      await update.mutateAsync({ [field]: value } as any);
      toast({ title: "Configuração atualizada" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleMarkup = async (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    try {
      await update.mutateAsync({ default_markup_percentage: num } as any);
    } catch {
      toast({ title: "Erro", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Feature Flags
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Billing Habilitado</Label>
              <p className="text-xs text-muted-foreground">Ativa o registro de eventos de billing</p>
            </div>
            <Switch checked={config.billing_enabled} onCheckedChange={(v) => handleToggle("billing_enabled", v)} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm flex items-center gap-1.5">
                Modo Sandbox
                <FlaskConical className="h-3.5 w-3.5 text-yellow-500" />
              </Label>
              <p className="text-xs text-muted-foreground">Quando ativo, nenhuma cobrança real é efetuada</p>
            </div>
            <Switch checked={config.sandbox_mode} onCheckedChange={(v) => handleToggle("sandbox_mode", v)} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Stripe Test Mode</Label>
              <p className="text-xs text-muted-foreground">Usa test API keys do Stripe</p>
            </div>
            <Switch checked={config.stripe_test_mode} onCheckedChange={(v) => handleToggle("stripe_test_mode", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Parâmetros Globais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Markup Padrão (%)</Label>
              <Input
                type="number"
                step="1"
                className="h-8 text-sm"
                defaultValue={config.default_markup_percentage}
                onBlur={(e) => handleMarkup(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Moeda Padrão</Label>
              <Input className="h-8 text-sm" value={config.default_currency} disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Status da Integração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stripe API Key</span>
              <Badge variant="outline" className="text-[10px] text-yellow-600">Não configurada</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Webhook Endpoint</span>
              <Badge variant="outline" className="text-[10px] text-yellow-600">Pendente</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modo</span>
              <Badge variant="outline" className="text-[10px]">
                {config.sandbox_mode ? "🧪 Sandbox" : "🟢 Produção"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

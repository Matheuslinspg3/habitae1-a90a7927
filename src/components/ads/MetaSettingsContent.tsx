import React, { useState, useEffect } from "react";
import { useAdAccount, useAdSettings } from "@/hooks/useAdSettings";
import { useLeadStages } from "@/hooks/useLeadStages";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Zap, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MetaSettingsContent() {
  const { account, isConnected, disconnectAccount, isSaving } = useAdAccount();
  const { settings, updateSettings, isSaving: isSavingSettings } = useAdSettings();
  const { leadStages } = useLeadStages();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [autoSend, setAutoSend] = useState(settings?.auto_send_to_crm ?? false);
  const [stageId, setStageId] = useState(settings?.crm_stage_id ?? "");

  // Handle OAuth callback results
  useEffect(() => {
    const metaSuccess = searchParams.get("meta_success");
    const metaError = searchParams.get("meta_error");

    if (metaSuccess) {
      toast({ title: "Conectado!", description: "Sua conta Meta Ads foi conectada com sucesso." });
      // Clean URL params
      searchParams.delete("meta_success");
      setSearchParams(searchParams, { replace: true });
    }

    if (metaError) {
      const errorMessages: Record<string, string> = {
        missing_params: "Parâmetros ausentes no callback.",
        invalid_state: "Estado inválido. Tente novamente.",
        server_config: "Configuração do servidor incompleta.",
        token_exchange: "Erro ao trocar código por token.",
        no_ad_account: "Nenhuma conta de anúncios encontrada no Meta.",
        db_save: "Erro ao salvar dados. Tente novamente.",
        unexpected: "Erro inesperado. Tente novamente.",
      };
      toast({
        title: "Erro na conexão",
        description: errorMessages[metaError] || metaError,
        variant: "destructive",
      });
      searchParams.delete("meta_error");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    if (settings) {
      setAutoSend(settings.auto_send_to_crm);
      setStageId(settings.crm_stage_id || "");
    }
  }, [settings]);

  const handleConnectMeta = () => {
    if (!profile?.organization_id || !profile?.user_id) return;

    const state = btoa(JSON.stringify({
      user_id: profile.user_id,
      org_id: profile.organization_id,
      redirect: window.location.pathname,
    }));

    const appId = import.meta.env.VITE_META_APP_ID;
    if (!appId) {
      // Fallback: use project ID to construct callback URL
      const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const redirectUri = `https://${supabaseProjectId}.supabase.co/functions/v1/meta-oauth-callback`;
      
      const oauthUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
      oauthUrl.searchParams.set("client_id", ""); // Will need META_APP_ID in env
      oauthUrl.searchParams.set("redirect_uri", redirectUri);
      oauthUrl.searchParams.set("state", state);
      oauthUrl.searchParams.set("scope", "ads_read,ads_management,leads_retrieval,pages_show_list");
      oauthUrl.searchParams.set("response_type", "code");

      toast({
        title: "Configuração necessária",
        description: "O VITE_META_APP_ID precisa ser configurado.",
        variant: "destructive",
      });
      return;
    }

    const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const redirectUri = `https://${supabaseProjectId}.supabase.co/functions/v1/meta-oauth-callback`;

    const oauthUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    oauthUrl.searchParams.set("client_id", appId);
    oauthUrl.searchParams.set("redirect_uri", redirectUri);
    oauthUrl.searchParams.set("state", state);
    oauthUrl.searchParams.set("scope", "ads_read,ads_management,leads_retrieval,pages_show_list");
    oauthUrl.searchParams.set("response_type", "code");

    window.location.href = oauthUrl.toString();
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
          <CardDescription>Conecte sua conta do Meta para gerenciar anúncios e leads.</CardDescription>
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
              {account?.name && (
                <p className="text-sm text-muted-foreground">
                  Nome: <strong>{account.name}</strong>
                </p>
              )}
              <Button variant="destructive" size="sm" onClick={() => disconnectAccount()}>
                Desconectar
              </Button>
            </div>
          ) : (
            <div className="space-y-4 max-w-md">
              <p className="text-sm text-muted-foreground">
                Clique no botão abaixo para conectar sua conta do Meta Ads. 
                Você será redirecionado para o Facebook para autorizar o acesso.
              </p>
              <Button
                onClick={handleConnectMeta}
                className="gap-2"
                size="lg"
              >
                <LogIn className="h-4 w-4" />
                Conectar com Meta
              </Button>
              <p className="text-xs text-muted-foreground">
                Permissões solicitadas: leitura de anúncios, gerenciamento de anúncios, 
                acesso a leads e páginas.
              </p>
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

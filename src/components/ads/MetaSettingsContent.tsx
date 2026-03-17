import React, { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdAccount, useAdSettings } from "@/hooks/useAdSettings";
import { useLeadStages } from "@/hooks/useLeadStages";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, LogIn, RefreshCw, WifiOff, XCircle, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MetaSettingsContent() {
  const { account, isConnected, disconnectAccount } = useAdAccount();
  const { settings, updateSettings, isSaving: isSavingSettings } = useAdSettings();
  const { leadStages } = useLeadStages();
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [autoSend, setAutoSend] = useState(settings?.auto_send_to_crm ?? false);
  const [stageId, setStageId] = useState(settings?.crm_stage_id ?? "");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isInitialSyncing, setIsInitialSyncing] = useState(false);

  useEffect(() => {
    if (settings) {
      setAutoSend(settings.auto_send_to_crm);
      setStageId(settings.crm_stage_id || "");
    }
  }, [settings]);

  useEffect(() => {
    const metaSuccess = searchParams.get("meta_success");
    const metaError = searchParams.get("meta_error");

    if (!metaSuccess && !metaError) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);

    const invalidateMetaQueries = async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ad-account"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-entities"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-insights"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-insights-aggregated"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-leads-count"] }),
      ]);
    };

    const handleOAuthResult = async () => {
      if (metaSuccess) {
        nextParams.delete("meta_success");
        setSearchParams(nextParams, { replace: true });
        setIsInitialSyncing(true);

        try {
          const [entitiesResult, leadsResult] = await Promise.all([
            supabase.functions.invoke("meta-sync-entities", {
              body: { days_back: 30 },
            }),
            supabase.functions.invoke("meta-sync-leads", {
              body: { days_back: 30 },
            }),
          ]);

          if (entitiesResult.error) throw entitiesResult.error;

          await invalidateMetaQueries();

          const ads = entitiesResult.data?.ads ?? 0;
          const insights = entitiesResult.data?.insights ?? 0;
          const leads = leadsResult.error ? 0 : (leadsResult.data?.synced ?? 0);

          toast({
            title: "Conectado!",
            description: `Conta conectada e sincronizada: ${ads} anúncios, ${insights} métricas e ${leads} leads.`,
          });
        } catch {
          await invalidateMetaQueries();
          toast({
            title: "Conta conectada",
            description: "A conexão foi concluída, mas a sincronização inicial não terminou. Use os botões abaixo para sincronizar.",
            variant: "destructive",
          });
        } finally {
          setIsInitialSyncing(false);
        }
      }

      if (metaError) {
        const errorMessages: Record<string, string> = {
          missing_params: "Parâmetros ausentes no callback.",
          invalid_state: "Estado inválido. Tente novamente.",
          server_config: "Configuração do servidor incompleta.",
          token_exchange: "Erro ao trocar código por token. O app Meta pode não estar em modo Live ou as permissões não foram aprovadas.",
          missing_permissions: "O Meta retornou o token sem todas as permissões necessárias. Aprove business_management no app e conecte novamente.",
          no_ad_account: "Nenhuma conta de anúncios encontrada. Verifique se o usuário tem acesso a uma conta de anúncios no Meta Business Suite.",
          db_save: "Erro ao salvar dados. Tente novamente.",
          unexpected: "Erro inesperado. Tente novamente.",
          access_denied: "O usuário negou as permissões solicitadas. Tente novamente e aceite todas as permissões.",
        };

        toast({
          title: "Erro na conexão",
          description: errorMessages[metaError] || metaError,
          variant: "destructive",
        });

        nextParams.delete("meta_error");
        setSearchParams(nextParams, { replace: true });
      }
    };

    void handleOAuthResult();
  }, [queryClient, searchParams, setSearchParams, toast]);

  const handleConnectMeta = async () => {
    if (!profile?.organization_id || !profile?.user_id) return;
    setIsRedirecting(true);

    try {
      const { data, error } = await supabase.functions.invoke("meta-app-id");
      if (error || !data?.app_id) {
        toast({
          title: "Erro",
          description: "Não foi possível obter o App ID do Meta. Verifique a configuração.",
          variant: "destructive",
        });
        setIsRedirecting(false);
        return;
      }

      const state = btoa(JSON.stringify({
        user_id: profile.user_id,
        org_id: profile.organization_id,
        redirect: window.location.pathname,
        origin: window.location.origin,
      }));

      const supabaseProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const redirectUri = `https://${supabaseProjectId}.supabase.co/functions/v1/meta-oauth-callback`;

      const oauthUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
      oauthUrl.searchParams.set("client_id", data.app_id);
      oauthUrl.searchParams.set("redirect_uri", redirectUri);
      oauthUrl.searchParams.set("state", state);
      oauthUrl.searchParams.set("scope", "ads_read,ads_management,business_management,pages_show_list,pages_read_engagement,pages_manage_ads,leads_retrieval");
      oauthUrl.searchParams.set("auth_type", "rerequest");
      oauthUrl.searchParams.set("response_type", "code");

      window.location.href = oauthUrl.toString();
    } catch {
      toast({ title: "Erro", description: "Falha ao iniciar conexão.", variant: "destructive" });
      setIsRedirecting(false);
    }
  };

  const handleSaveAutomation = () => {
    updateSettings({ autoSendToCrm: autoSend, crmStageId: stageId || null });
  };

  return (
    <div className="space-y-6">
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
              {isInitialSyncing && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sincronizando anúncios, métricas e leads iniciais...
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
                disabled={isRedirecting}
              >
                {isRedirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {isRedirecting ? "Redirecionando..." : "Conectar com Meta"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Permissões solicitadas: leitura de anúncios, gerenciamento de anúncios,
                acesso a leads e páginas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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
                  {leadStages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={handleSaveAutomation} disabled={isSavingSettings}>
            {isSavingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Automação
          </Button>
        </CardContent>
      </Card>

      {isConnected && <SyncSection />}
    </div>
  );
}

function SyncSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncingEntities, setSyncingEntities] = useState(false);
  const [syncingLeads, setSyncingLeads] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<Record<string, any> | null>(null);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-sync-entities", {
        body: { days_back: 1 },
      });
      if (error) throw error;
      toast({ title: "Conexão OK!", description: `Encontrados ${data.campaigns} campanhas, ${data.ads} anúncios.` });
    } catch (err: any) {
      toast({ title: "Falha na conexão", description: err.message || "Verifique se o token não expirou.", variant: "destructive" });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncEntities = async () => {
    setSyncingEntities(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-sync-entities", {
        body: { days_back: 30 },
      });
      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ad-entities"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-insights"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-insights-aggregated"] }),
      ]);

      setLastSyncResult(data);
      toast({ title: "Sincronização concluída", description: `${data.entities} entidades e ${data.insights} métricas sincronizadas.` });
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" });
    } finally {
      setSyncingEntities(false);
    }
  };

  const handleSyncLeads = async (daysBack: number) => {
    setSyncingLeads(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-sync-leads", {
        body: { days_back: daysBack },
      });
      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ad-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["ad-leads-count"] }),
      ]);

      setLastSyncResult(data);
      toast({ title: "Leads sincronizados", description: `${data.synced} leads sincronizados. ${data.auto_sent > 0 ? `${data.auto_sent} enviados ao CRM automaticamente.` : ""}` });
    } catch (err: any) {
      toast({ title: "Erro ao sincronizar leads", description: err.message, variant: "destructive" });
    } finally {
      setSyncingLeads(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Sincronização</CardTitle>
        <CardDescription>Sincronize dados manualmente com o Meta Ads.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testingConnection}>
            {testingConnection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WifiOff className="mr-2 h-4 w-4" />}
            Testar Conexão
          </Button>
          <Button variant="outline" size="sm" onClick={handleSyncEntities} disabled={syncingEntities}>
            {syncingEntities ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sincronizar Ads + Métricas (30d)
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSyncLeads(7)} disabled={syncingLeads}>
            {syncingLeads ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Backfill Leads (7d)
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSyncLeads(30)} disabled={syncingLeads}>
            {syncingLeads ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Backfill Leads (30d)
          </Button>
        </div>

        {lastSyncResult && (
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium">Último resultado:</p>
            <pre className="whitespace-pre-wrap">{JSON.stringify(lastSyncResult, null, 2)}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
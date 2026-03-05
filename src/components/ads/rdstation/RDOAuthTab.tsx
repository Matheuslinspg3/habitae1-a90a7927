import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, Download, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { useRDStationSettings } from "@/hooks/useRDStationSettings";
import RDSyncDialog from "./RDSyncDialog";

export default function RDOAuthTab() {
  const { settings, orgId, queryClient, hasOAuth, oauthExpired } = useRDStationSettings();
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);

  // Check for OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("rd_success") === "true") {
      toast.success("Conta RD Station conectada com sucesso via OAuth!");
      queryClient.invalidateQueries({ queryKey: ["rd-station-settings"] });
      window.history.replaceState({}, "", window.location.pathname + "?tab=oauth");
    }
    if (params.get("rd_error")) {
      const errMap: Record<string, string> = {
        missing_params: "Parâmetros ausentes no callback",
        invalid_state: "Estado inválido no callback",
        server_config: "Configuração do servidor incompleta",
        token_exchange: "Erro ao trocar o código por token",
        db_save: "Erro ao salvar tokens no banco",
        unexpected: "Erro inesperado",
      };
      toast.error(errMap[params.get("rd_error")!] || "Erro ao conectar: " + params.get("rd_error"));
      window.history.replaceState({}, "", window.location.pathname + "?tab=oauth");
    }
  }, []);

  const handleConnectOAuth = async () => {
    setIsConnectingOAuth(true);
    try {
      const { data, error } = await supabase.functions.invoke("rd-station-app-id");
      if (error || !data?.client_id) {
        toast.error("Erro ao obter Client ID do RD Station.");
        setIsConnectingOAuth(false);
        return;
      }

      const clientId = data.client_id;
      const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rd-station-oauth-callback`;
      const state = btoa(JSON.stringify({ org_id: orgId, origin: window.location.origin }));
      const authUrl = `https://api.rd.services/auth/dialog?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
      window.location.href = authUrl;
    } catch (err: any) {
      toast.error("Erro ao iniciar conexão OAuth.");
      setIsConnectingOAuth(false);
    }
  };

  const handleDisconnectOAuth = useMutation({
    mutationFn: async () => {
      if (!settings?.id) return;
      const { error } = await supabase
        .from("rd_station_settings")
        .update({
          oauth_access_token: null,
          oauth_refresh_token: null,
          oauth_token_expires_at: null,
          oauth_client_id: null,
        } as any)
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rd-station-settings"] });
      toast.success("Conexão OAuth desconectada.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* OAuth Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Conexão OAuth
          </CardTitle>
          <CardDescription>
            Conecte sua conta RD Station via OAuth para sincronizar contatos automaticamente.
            Necessário para puxar leads do RD Station para o CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasOAuth ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {oauthExpired ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> Token Expirado
                  </Badge>
                ) : (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Conectado
                  </Badge>
                )}
                {(settings as any)?.oauth_token_expires_at && (
                  <span className="text-xs text-muted-foreground">
                    Expira em {format(new Date((settings as any).oauth_token_expires_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {oauthExpired && (
                  <Button onClick={handleConnectOAuth} disabled={isConnectingOAuth}>
                    {isConnectingOAuth && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Reconectar
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    if (confirm("Tem certeza que deseja desconectar? Você não poderá sincronizar leads até reconectar.")) {
                      handleDisconnectOAuth.mutate();
                    }
                  }}
                  disabled={handleDisconnectOAuth.isPending}
                >
                  Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                A conexão OAuth é necessária para sincronizar contatos do RD Station.
                Clique no botão abaixo para autorizar o acesso à sua conta.
              </p>
              <Button onClick={handleConnectOAuth} disabled={isConnectingOAuth}>
                {isConnectingOAuth ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4 mr-2" />
                )}
                Conectar com RD Station
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Leads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Sincronizar Leads
          </CardTitle>
          <CardDescription>
            Escolha quais contatos do RD Station importar para o CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Veja a lista de contatos disponíveis, selecione quais importar e atualize leads existentes com novas informações.
          </p>
          <Button onClick={() => setSyncDialogOpen(true)} disabled={!hasOAuth}>
            <Users className="h-4 w-4 mr-2" />
            Abrir Lista de Contatos
          </Button>
          {!hasOAuth && (
            <p className="text-xs text-muted-foreground">
              Conecte sua conta RD Station via OAuth acima para habilitar a sincronização.
            </p>
          )}
        </CardContent>
      </Card>

      <RDSyncDialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen} />
    </div>
  );
}

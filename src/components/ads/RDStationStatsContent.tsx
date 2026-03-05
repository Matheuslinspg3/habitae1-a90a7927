import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, RefreshCw, Users, Mail, TrendingUp,
  BarChart3, ArrowDownToLine, AlertCircle, Webhook
} from "lucide-react";

export default function RDStationStatsContent() {
  const { profile, session } = useAuth();
  const orgId = profile?.organization_id;

  const { data: stats, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["rd-station-stats", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("rd-station-stats", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId && !!session,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando estatísticas...</span>
      </div>
    );
  }

  if (error) {
    const errMsg = (error as any)?.message || "Erro ao carregar estatísticas";
    const isApiNotConfigured = errMsg.includes("API keys not configured");
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isApiNotConfigured
              ? "Conecte sua conta RD Station via OAuth na aba de Sincronização para ver as estatísticas."
              : errMsg}
          </p>
        </CardContent>
      </Card>
    );
  }

  const funnel = stats?.funnel;
  const emails = stats?.emails;
  const internal = stats?.internal;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Estatísticas RD Station</h3>
          <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Internal CRM Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Leads do RD (mês)"
          value={internal?.rd_leads_month ?? 0}
          icon={<ArrowDownToLine className="h-4 w-4" />}
          color="text-primary"
        />
        <StatCard
          title="Leads do RD (total)"
          value={internal?.rd_leads_total ?? 0}
          icon={<Users className="h-4 w-4" />}
          color="text-primary"
        />
        <StatCard
          title="Webhooks (mês)"
          value={internal?.webhooks_month ?? 0}
          icon={<Webhook className="h-4 w-4" />}
          color="text-muted-foreground"
        />
        <StatCard
          title="Webhooks (total)"
          value={internal?.webhooks_total ?? 0}
          icon={<Webhook className="h-4 w-4" />}
          color="text-muted-foreground"
        />
      </div>

      {/* Funnel */}
      {funnel && !funnel.error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Funil de Vendas
            </CardTitle>
            <CardDescription>Dados do funil do RD Station Marketing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {funnel.visitors_count != null && (
                <FunnelStep label="Visitantes" value={funnel.visitors_count} />
              )}
              {funnel.contacts_count != null && (
                <FunnelStep label="Leads" value={funnel.contacts_count} />
              )}
              {funnel.qualified_count != null && (
                <FunnelStep label="Oportunidades" value={funnel.qualified_count} />
              )}
              {funnel.sales_count != null && (
                <FunnelStep label="Vendas" value={funnel.sales_count} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {funnel?.error && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Funil indisponível — esse recurso pode não estar disponível no seu plano do RD Station ({funnel.error}).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Email Stats */}
      {emails && !emails.error && Array.isArray(emails) && emails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              E-mail Marketing
            </CardTitle>
            <CardDescription>Últimas campanhas de email</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {emails.slice(0, 10).map((email: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{email.name || email.subject || `Campanha ${i + 1}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {email.contacts_count ?? 0} contatos
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {email.open_rate != null && (
                      <Badge variant="secondary">{(email.open_rate * 100).toFixed(1)}% abertura</Badge>
                    )}
                    {email.click_rate != null && (
                      <Badge variant="outline">{(email.click_rate * 100).toFixed(1)}% cliques</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {emails?.error && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Emails indisponíveis — esse recurso pode não estar disponível no seu plano do RD Station ({emails.error}).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <span className={color}>{icon}</span>
          <span className="text-xs text-muted-foreground">{title}</span>
        </div>
        <p className="text-2xl font-bold">{value.toLocaleString("pt-BR")}</p>
      </CardContent>
    </Card>
  );
}

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/50">
      <p className="text-2xl font-bold">{value.toLocaleString("pt-BR")}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

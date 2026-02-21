import React, { useState } from "react";
import { useAggregatedInsights } from "@/hooks/useAdInsights";
import { useAdAccount } from "@/hooks/useAdSettings";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { BarChart3, Settings } from "lucide-react";
import { subDays } from "date-fns";
import { useNavigate } from "react-router-dom";

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "14", label: "Últimos 14 dias" },
  { value: "30", label: "Últimos 30 dias" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function MetaStats() {
  const [period, setPeriod] = useState("7");
  const { isConnected } = useAdAccount();
  const navigate = useNavigate();

  const dateRange = {
    from: subDays(new Date(), parseInt(period)),
    to: new Date(),
  };

  const { data: insights = [], isLoading } = useAggregatedInsights(dateRange);

  const totals = insights.reduce(
    (acc, i) => ({
      impressions: acc.impressions + i.impressions,
      clicks: acc.clicks + i.clicks,
      spend: acc.spend + i.spend,
      leads: acc.leads + i.leads,
    }),
    { impressions: 0, clicks: 0, spend: 0, leads: 0 }
  );

  if (!isConnected) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader title="Estatísticas" description="Métricas dos seus anúncios Meta" />
        <Card className="max-w-lg mx-auto">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <BarChart3 className="h-16 w-16 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">Meta Ads não conectado</h3>
            <p className="text-muted-foreground text-center text-sm">Conecte sua conta para ver estatísticas.</p>
            <Button onClick={() => navigate("/anuncios/meta/configuracoes")}>
              <Settings className="h-4 w-4 mr-2" /> Configurações
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <PageHeader title="Estatísticas" description="Métricas gerais dos anúncios Meta" />
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Impressões</p><p className="text-2xl font-bold">{totals.impressions.toLocaleString("pt-BR")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cliques</p><p className="text-2xl font-bold">{totals.clicks.toLocaleString("pt-BR")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Gasto</p><p className="text-2xl font-bold">{formatCurrency(totals.spend)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Leads</p><p className="text-2xl font-bold">{totals.leads.toLocaleString("pt-BR")}</p></CardContent></Card>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : insights.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">Nenhum dado de estatísticas encontrado. Sincronize nas configurações.</p>
            <Button variant="outline" onClick={() => navigate("/anuncios/meta/configuracoes")}>Sincronizar Estatísticas</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Desempenho por Anúncio</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anúncio</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insights.map(i => (
                  <TableRow key={i.external_id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/anuncios/meta/ad/${i.external_id}`)}>
                    <TableCell className="font-medium max-w-[200px] truncate">{i.ad_name}</TableCell>
                    <TableCell className="text-right">{i.impressions.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right">{i.clicks.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right">{i.ctr.toFixed(2)}%</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.cpc)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.spend)}</TableCell>
                    <TableCell className="text-right">{i.leads}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.cpl)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import React, { useState } from "react";
import { useAdInsights } from "@/hooks/useAdInsights";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3 } from "lucide-react";
import { subDays } from "date-fns";

const PERIOD_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "14", label: "14 dias" },
  { value: "30", label: "30 dias" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

interface AdDetailStatsProps {
  externalAdId: string;
}

export function AdDetailStats({ externalAdId }: AdDetailStatsProps) {
  const [period, setPeriod] = useState("7");
  const dateRange = { from: subDays(new Date(), parseInt(period)), to: new Date() };
  const { data: insights = [], isLoading } = useAdInsights(externalAdId, dateRange);

  const totals = insights.reduce(
    (acc, i) => ({
      impressions: acc.impressions + i.impressions,
      clicks: acc.clicks + i.clicks,
      spend: acc.spend + Number(i.spend),
      leads: acc.leads + i.leads,
    }),
    { impressions: 0, clicks: 0, spend: 0, leads: 0 }
  );

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : insights.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">Nenhum dado de estatísticas para este período.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Impressões</p><p className="text-lg font-bold">{totals.impressions.toLocaleString("pt-BR")}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Cliques</p><p className="text-lg font-bold">{totals.clicks.toLocaleString("pt-BR")}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">CTR</p><p className="text-lg font-bold">{ctr.toFixed(2)}%</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">CPC</p><p className="text-lg font-bold">{formatCurrency(cpc)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Gasto</p><p className="text-lg font-bold">{formatCurrency(totals.spend)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Leads</p><p className="text-lg font-bold">{totals.leads}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">CPL</p><p className="text-lg font-bold">{formatCurrency(cpl)}</p></CardContent></Card>
        </div>
      )}
    </div>
  );
}

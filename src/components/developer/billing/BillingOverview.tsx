import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, DollarSign, TrendingUp, Users, BarChart3 } from "lucide-react";
import { useAiUsageEvents, useUsageAggregations } from "@/hooks/useAiBilling";
import { formatCost, usdToBrl } from "@/services/ai-billing/pricing-calculator";

export function BillingOverview() {
  const [period, setPeriod] = useState(30);
  const { data: events, isLoading } = useAiUsageEvents({ period });
  const agg = useUsageAggregations(events);

  if (isLoading) {
    return (
      <Card><CardContent className="p-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }

  const maxDayCount = Math.max(...Object.values(agg.byDay).map(d => d.count), 1);

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex justify-end">
        <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v))}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Zap} label="Requests" value={agg.totalRequests.toLocaleString()} sub={`${agg.successRate.toFixed(0)}% sucesso`} />
        <KpiCard icon={BarChart3} label="Tokens" value={`${(agg.totalTokens / 1000).toFixed(1)}k`} sub={`In: ${(agg.totalInputTokens/1000).toFixed(1)}k / Out: ${(agg.totalOutputTokens/1000).toFixed(1)}k`} />
        <KpiCard icon={DollarSign} label="Custo Provider" value={formatCost(agg.totalProviderCost)} sub={`R$ ${usdToBrl(agg.totalProviderCost).toFixed(2)}`} />
        <KpiCard icon={TrendingUp} label="Valor Cobrado" value={formatCost(agg.totalBilledAmount)} sub={`R$ ${usdToBrl(agg.totalBilledAmount).toFixed(2)}`} />
        <KpiCard icon={DollarSign} label="Margem" value={formatCost(agg.totalBilledAmount - agg.totalProviderCost)} sub="lucro simulado" />
        <KpiCard icon={Users} label="Usuários" value={Object.keys(agg.byUser).length.toString()} sub="usuários únicos" />
      </div>

      {/* Daily chart */}
      {Object.keys(agg.byDay).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Requests por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-24">
              {Object.entries(agg.byDay)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(-14)
                .map(([day, d]) => (
                  <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full bg-primary/30 rounded-t transition-all hover:bg-primary/50"
                      style={{ height: `${(d.count / maxDayCount) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
                      title={`${day}: ${d.count} req, ${d.tokens} tok, ${formatCost(d.cost)}`}
                    />
                    <span className="text-[8px] text-muted-foreground">{day.slice(8)}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* By Provider */}
      {Object.keys(agg.byProvider).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Por Provider</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {Object.entries(agg.byProvider)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([provider, d]) => (
                <div key={provider} className="flex items-center justify-between text-xs border rounded p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{provider}</Badge>
                    <span className="text-muted-foreground">{d.count} req</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{(d.tokens / 1000).toFixed(1)}k tok</span>
                    <span>Custo: {formatCost(d.cost)}</span>
                    <span className="font-medium text-foreground">Cobra: {formatCost(d.billed)}</span>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* By Model */}
      {Object.keys(agg.byModel).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Por Modelo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {Object.entries(agg.byModel)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([model, d]) => (
                <div key={model} className="flex items-center justify-between text-xs border rounded p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">{model}</Badge>
                    <span className="text-muted-foreground">{d.count} req</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{(d.tokens / 1000).toFixed(1)}k tok</span>
                    <span className="font-medium text-foreground">{formatCost(d.billed)}</span>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {agg.totalRequests === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum evento de billing registrado neste período.
        </p>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium uppercase">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BarChart3, DollarSign, Zap, Image as ImageIcon, Type } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface UsageLog {
  id: string;
  provider: string;
  model: string;
  function_name: string;
  usage_type: string;
  tokens_input: number;
  tokens_output: number;
  estimated_cost_usd: number;
  success: boolean;
  created_at: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  lovable: "bg-primary/20 text-primary",
  openai: "bg-green-500/20 text-green-700 dark:text-green-400",
  gemini: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  anthropic: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
  groq: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  stability: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400",
  leonardo: "bg-pink-500/20 text-pink-700 dark:text-pink-400",
  flux: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
};

export function AIUsageDashboard() {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");

  useEffect(() => { loadLogs(); }, [period]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(period));

      const { data, error } = await supabase
        .from("ai_usage_logs")
        .select("*")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs((data as any[]) || []);
    } catch (err) {
      console.error("Erro ao carregar logs de uso:", err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalRequests = logs.length;
    const successfulRequests = logs.filter(l => l.success).length;
    const totalCost = logs.reduce((sum, l) => sum + (l.estimated_cost_usd || 0), 0);
    const totalTokensIn = logs.reduce((sum, l) => sum + (l.tokens_input || 0), 0);
    const totalTokensOut = logs.reduce((sum, l) => sum + (l.tokens_output || 0), 0);
    const textRequests = logs.filter(l => l.usage_type === "text").length;
    const imageRequests = logs.filter(l => l.usage_type === "image").length;

    // By provider
    const byProvider: Record<string, { count: number; cost: number; tokens: number }> = {};
    logs.forEach(l => {
      if (!byProvider[l.provider]) byProvider[l.provider] = { count: 0, cost: 0, tokens: 0 };
      byProvider[l.provider].count++;
      byProvider[l.provider].cost += l.estimated_cost_usd || 0;
      byProvider[l.provider].tokens += (l.tokens_input || 0) + (l.tokens_output || 0);
    });

    // By day (last 7 entries)
    const byDay: Record<string, number> = {};
    logs.forEach(l => {
      const day = l.created_at.split("T")[0];
      byDay[day] = (byDay[day] || 0) + 1;
    });

    return { totalRequests, successfulRequests, totalCost, totalTokensIn, totalTokensOut, textRequests, imageRequests, byProvider, byDay };
  }, [logs]);

  const maxDayCount = Math.max(...Object.values(stats.byDay), 1);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Uso de IA
          </CardTitle>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard icon={Zap} label="Requests" value={stats.totalRequests.toString()} sub={`${stats.successfulRequests} com sucesso`} />
          <SummaryCard icon={DollarSign} label="Custo Estimado" value={`$${stats.totalCost.toFixed(4)}`} sub={`R$ ${(stats.totalCost * 5.5).toFixed(2)}`} />
          <SummaryCard icon={Type} label="Texto" value={stats.textRequests.toString()} sub={`${((stats.totalTokensIn + stats.totalTokensOut) / 1000).toFixed(1)}k tokens`} />
          <SummaryCard icon={ImageIcon} label="Imagem" value={stats.imageRequests.toString()} sub="gerações" />
        </div>

        {/* Bar chart by day */}
        {Object.keys(stats.byDay).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">Requests por Dia</h4>
            <div className="flex items-end gap-1 h-20">
              {Object.entries(stats.byDay)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(-14)
                .map(([day, count]) => (
                  <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full bg-primary/30 rounded-t transition-all hover:bg-primary/50"
                      style={{ height: `${(count / maxDayCount) * 100}%`, minHeight: count > 0 ? "4px" : "0" }}
                      title={`${day}: ${count} requests`}
                    />
                    <span className="text-[8px] text-muted-foreground">{day.slice(8)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* By Provider */}
        {Object.keys(stats.byProvider).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">Por Provedor</h4>
            <div className="space-y-1.5">
              {Object.entries(stats.byProvider)
                .sort(([, a], [, b]) => b.count - a.count)
                .map(([provider, data]) => (
                  <div key={provider} className="flex items-center justify-between text-xs rounded border p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`text-[10px] ${PROVIDER_COLORS[provider] || ""}`}>
                        {provider}
                      </Badge>
                      <span className="text-muted-foreground">{data.count} requests</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      {data.tokens > 0 && <span>{(data.tokens / 1000).toFixed(1)}k tok</span>}
                      <span className="font-medium text-foreground">${data.cost.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {logs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum uso de IA registrado neste período.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub: string }) {
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

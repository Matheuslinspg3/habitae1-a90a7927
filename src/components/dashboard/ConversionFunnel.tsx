import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDemo } from "@/contexts/DemoContext";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ArrowRight } from "lucide-react";
// PERF: Uses single RPC instead of full useLeads() hook
import { useDashboardPipeline } from "@/hooks/useDashboardPipeline";

export function ConversionFunnel() {
  const { stages, overallRate, isLoading } = useDashboardPipeline();
  const { isDemoMode } = useDemo();

  const funnelStages = useMemo(() =>
    stages.filter(s => !s.is_loss),
    [stages]
  );

  const funnelData = useMemo(() => {
    const mapped = funnelStages.map((stage, index) => {
      const prevCount = index > 0 ? funnelStages[index - 1].count : stage.count;
      const conversionRate = prevCount > 0 && index > 0 ? ((stage.count / prevCount) * 100).toFixed(0) : null;
      return { ...stage, conversionRate };
    });
    const totalLeads = mapped.reduce((sum, s) => sum + s.count, 0);
    return { stages: mapped, totalLeads };
  }, [funnelStages]);

  if (isLoading && !isDemoMode) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-display">Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    );
  }

  if (funnelData.totalLeads === 0) return null;

  const maxCount = Math.max(...funnelData.stages.map(s => s.count), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-display flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Funil de Conversão
          </CardTitle>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary">{overallRate}%</span>
            <p className="text-[10px] text-muted-foreground">taxa geral</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {funnelData.stages.map((stage, index) => {
          const widthPct = Math.max((stage.count / maxCount) * 100, 6);
          return (
            <div key={stage.id} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-20 truncate">{stage.name}</span>
              <div className="flex-1 h-6 bg-muted/30 rounded overflow-hidden relative">
                <div
                  className="h-full rounded transition-all"
                  style={{ width: `${widthPct}%`, backgroundColor: stage.color, opacity: 0.7 + (index * 0.05) }}
                />
                <span className="absolute inset-0 flex items-center pl-2 text-[10px] font-medium">
                  {stage.count}
                </span>
              </div>
              {stage.conversionRate && (
                <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground w-12 shrink-0">
                  <ArrowRight className="h-2.5 w-2.5" />
                  {stage.conversionRate}%
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

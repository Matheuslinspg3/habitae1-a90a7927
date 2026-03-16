import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useDemo } from "@/contexts/DemoContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";
// PERF: Uses single RPC instead of full useLeads() hook
import { useDashboardPipeline } from "@/hooks/useDashboardPipeline";

export function PipelineSummary() {
  const { isLoading, stages } = useDashboardPipeline();
  const { isDemoMode } = useDemo();
  const navigate = useNavigate();

  // PERF: Filter pipeline stages (exclude loss) with useMemo
  const pipelineStages = useMemo(() =>
    stages.filter(s => !s.is_loss),
    [stages]
  );

  const totalLeads = pipelineStages.reduce((sum, s) => sum + s.count, 0);
  const maxCount = Math.max(...pipelineStages.map(s => s.count), 1);

  if (isLoading && !isDemoMode) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-display">Funil de Leads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (totalLeads === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-display">Funil de Leads</CardTitle>
          <span className="text-sm text-muted-foreground">{totalLeads} leads ativos</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {pipelineStages.map(stage => {
          if (stage.count === 0) return null;
          const widthPct = Math.max((stage.count / maxCount) * 100, 8);

          return (
            <button
              key={stage.id}
              onClick={() => navigate('/crm')}
              className="w-full flex items-center gap-3 group hover:bg-muted/50 rounded-lg p-1.5 transition-colors text-left"
            >
              <span className="text-xs text-muted-foreground w-24 truncate">
                {stage.name}
              </span>
              <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${widthPct}%`, backgroundColor: stage.color }}
                />
              </div>
              <span className="text-sm font-semibold w-8 text-right">{stage.count}</span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

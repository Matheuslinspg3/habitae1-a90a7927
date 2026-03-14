import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp } from "lucide-react";
import { useDashboardFunnel, type FunnelStage } from "@/hooks/useDashboardFunnel";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  dateRange: { from: Date; to: Date };
}

export function DetailedFunnel({ dateRange }: Props) {
  const { data: stages = [], isLoading } = useDashboardFunnel(dateRange);
  const [selectedStage, setSelectedStage] = useState<FunnelStage | null>(null);

  // Compute advancement rates
  const stagesWithRates = stages.map((stage, i) => {
    const nextCount = i < stages.length - 1 ? stages[i + 1]?.count : undefined;
    const advancementRate = stage.count > 0 && nextCount !== undefined
      ? Math.round((nextCount / stage.count) * 100)
      : null;
    return { ...stage, advancementRate };
  });

  // Leads in selected stage
  const { data: stageLeads = [] } = useQuery({
    queryKey: ["funnel_stage_leads", selectedStage?.stage_id],
    queryFn: async () => {
      if (!selectedStage) return [];
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, temperature, broker_id, updated_at")
        .eq("lead_stage_id", selectedStage.stage_id)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedStage,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-display">Funil Detalhado</CardTitle>
        </CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    );
  }

  if (stages.length === 0) return null;

  const tempBadge = (temp: string | null) => {
    if (temp === "quente") return <Badge variant="destructive" className="text-[10px]">🔴 Quente</Badge>;
    if (temp === "morno") return <Badge className="bg-amber-500/15 text-amber-700 border-amber-200 text-[10px]">🟡 Morno</Badge>;
    return <Badge variant="secondary" className="text-[10px]">⚪ Frio</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-display flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Funil Detalhado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={stages.length * 48 + 20}>
            <BarChart data={stagesWithRates} layout="vertical" margin={{ left: 0, right: 40 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip
                formatter={(value: number) => [value, "Leads"]}
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
              />
              <Bar
                dataKey="count"
                radius={[0, 6, 6, 0]}
                cursor="pointer"
                onClick={(_: unknown, index: number) => setSelectedStage(stagesWithRates[index])}
              >
                {stagesWithRates.map((stage) => (
                  <Cell key={stage.stage_id} fill={stage.color || "hsl(var(--primary))"} fillOpacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-2 space-y-0.5">
            {stagesWithRates.map((stage) =>
              stage.advancementRate !== null ? (
                <p key={stage.stage_id} className="text-[10px] text-muted-foreground pl-[100px]">
                  → {stage.advancementRate}% avançam
                </p>
              ) : null
            )}
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!selectedStage} onOpenChange={() => setSelectedStage(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selectedStage?.name} ({selectedStage?.count})</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2 overflow-y-auto max-h-[70vh]">
            {stageLeads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{lead.name}</p>
                </div>
                {tempBadge(lead.temperature)}
              </div>
            ))}
            {stageLeads.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum lead neste estágio</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

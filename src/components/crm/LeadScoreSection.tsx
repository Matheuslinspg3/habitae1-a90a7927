import { useMemo } from "react";
import { useLeadScore } from "@/hooks/useLeadScore";
import { EVENT_TYPE_LABELS } from "@/lib/leadScore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles, TrendingUp, TrendingDown, ArrowRight, Loader2, BarChart3 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import type { Lead } from "@/hooks/useLeads";
import { toast } from "sonner";

interface LeadScoreSectionProps {
  lead: Lead;
}

const TEMP_BADGE: Record<string, { label: string; emoji: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  quente: { label: "Quente", emoji: "🔴", variant: "destructive" },
  morno: { label: "Morno", emoji: "🟡", variant: "secondary" },
  frio: { label: "Frio", emoji: "⚪", variant: "outline" },
};

export function LeadScoreSection({ lead }: LeadScoreSectionProps) {
  const leadAny = lead as any;
  const score = leadAny.score ?? 0;
  const temperature = lead.temperature || "frio";
  const aiSummary = leadAny.ai_summary as string | null;
  const aiSummaryAt = leadAny.ai_summary_at as string | null;

  const { events, scoreHistory, trend, isLoadingEvents, isLoadingHistory, generateSummary } = useLeadScore(lead.id);

  const tempBadge = TEMP_BADGE[temperature] || TEMP_BADGE.frio;

  const canGenerateSummary = useMemo(() => {
    if (!aiSummaryAt) return true;
    const diff = Date.now() - new Date(aiSummaryAt).getTime();
    return diff > 24 * 60 * 60 * 1000; // 24h
  }, [aiSummaryAt]);

  const chartData = useMemo(() => {
    return scoreHistory.map((d) => ({
      ...d,
      label: new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    }));
  }, [scoreHistory]);

  // Check if lead is inactive (> 48h since last update)
  const isInactive = useMemo(() => {
    const diff = Date.now() - new Date(lead.updated_at).getTime();
    return diff > 48 * 60 * 60 * 1000;
  }, [lead.updated_at]);

  // Check if we have enough data points for a chart
  const hasEnoughChartData = useMemo(() => {
    const uniqueDays = new Set(scoreHistory.filter(d => d.score > 0).map(d => d.date));
    return uniqueDays.size >= 3;
  }, [scoreHistory]);

  const handleGenerateSummary = async () => {
    try {
      await generateSummary.mutateAsync({ id: lead.id, name: lead.name, score, temperature });
      toast.success("Resumo gerado com sucesso!");
    } catch {
      toast.error("Não foi possível gerar o resumo. Tente novamente.");
    }
  };

  const summaryAge = aiSummaryAt
    ? formatDistanceToNow(new Date(aiSummaryAt), { addSuffix: true, locale: ptBR })
    : null;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          Temperatura & Score
        </h3>

        {/* Score block */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-3xl font-bold tabular-nums">{score}</div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Badge variant={tempBadge.variant} className="text-xs gap-1">
                  {tempBadge.emoji} {tempBadge.label}
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Score atual: {score} pontos</p>
            </TooltipContent>
          </Tooltip>

          {/* Trend - only show if lead is active */}
          {!isInactive && trend === "heating" && (
            <Badge variant="outline" className="gap-1 text-xs">
              <TrendingUp className="h-3 w-3" /> Aquecendo
            </Badge>
          )}
          {!isInactive && trend === "cooling" && (
            <Badge variant="outline" className="gap-1 text-xs">
              <TrendingDown className="h-3 w-3" /> Esfriando
            </Badge>
          )}
          {!isInactive && trend === "stable" && (
            <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
              <ArrowRight className="h-3 w-3" /> Estável
            </Badge>
          )}
        </div>

        <Progress value={Math.min(score, 100)} className="h-2" />

        <p className="text-xs text-muted-foreground">
          Atualizado {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true, locale: ptBR })}
        </p>

        {/* Chart */}
        <div className="pt-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Evolução (14 dias)</p>
          {isLoadingHistory ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : hasEnoughChartData ? (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={chartData}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(value: number) => [`${value} pts`, "Score"]}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center border rounded-lg bg-muted/30">
              <BarChart3 className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">
                Aguardando mais interações para gerar o gráfico
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Necessário pelo menos 3 dias com atividade
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Recent events */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Últimos eventos</p>
          {isLoadingEvents ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full rounded" />)}
            </div>
          ) : events.length > 0 ? (
            <div className="space-y-1.5">
              {events.map((event: any) => {
                const info = EVENT_TYPE_LABELS[event.event_type] || { label: event.event_type, emoji: "📌" };
                return (
                  <div key={event.id} className="flex items-center justify-between text-xs py-1">
                    <span className="flex items-center gap-1.5">
                      <span>{info.emoji}</span>
                      <span>{info.label}</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {event.score_delta > 0 ? "+" : ""}{event.score_delta}
                      </Badge>
                    </span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum evento registrado ainda.</p>
          )}
        </div>

        <Separator />

        {/* AI Summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Resumo IA</p>
            <div className="flex items-center gap-2">
              {summaryAge && (
                <span className="text-[10px] text-muted-foreground">Gerado {summaryAge}</span>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={handleGenerateSummary}
                disabled={!canGenerateSummary || generateSummary.isPending}
              >
                {generateSummary.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {generateSummary.isPending ? "Gerando..." : canGenerateSummary ? "Gerar resumo" : "Gerado recentemente"}
              </Button>
            </div>
          </div>
          {aiSummary && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-3 text-sm whitespace-pre-wrap flex gap-2">
                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{aiSummary}</span>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

import { useMemo } from "react";
import { useLeadScore } from "@/hooks/useLeadScore";
import { EVENT_TYPE_LABELS } from "@/lib/leadScore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Sparkles, TrendingUp, TrendingDown, ArrowRight, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Lead } from "@/hooks/useLeads";
import { toast } from "sonner";

interface LeadScoreSectionProps {
  lead: Lead;
}

const TEMP_BADGE: Record<string, { label: string; emoji: string; className: string }> = {
  quente: { label: "Quente", emoji: "🔴", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300" },
  morno: { label: "Morno", emoji: "🟡", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" },
  frio: { label: "Frio", emoji: "⚪", className: "bg-muted text-muted-foreground" },
};

export function LeadScoreSection({ lead }: LeadScoreSectionProps) {
  const leadAny = lead as any;
  const score = leadAny.score ?? 0;
  const temperature = lead.temperature || "frio";
  const aiSummary = leadAny.ai_summary as string | null;
  const aiSummaryAt = leadAny.ai_summary_at as string | null;

  const { events, scoreHistory, trend, isLoadingEvents, isLoadingHistory, generateSummary } = useLeadScore(lead.id);

  const tempBadge = TEMP_BADGE[temperature] || TEMP_BADGE.frio;

  const progressColor = useMemo(() => {
    if (score >= 70) return "bg-orange-500";
    if (score >= 40) return "bg-amber-500";
    return "bg-muted-foreground";
  }, [score]);

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

  const handleGenerateSummary = async () => {
    try {
      await generateSummary.mutateAsync({ id: lead.id, name: lead.name, score, temperature });
      toast.success("Resumo gerado com sucesso!");
    } catch {
      toast.error("Erro ao gerar resumo do lead");
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <span>Temperatura & Score</span>
      </h3>

      {/* Score block */}
      <div className="flex items-center gap-4">
        <div className="text-3xl font-bold tabular-nums">{score}</div>
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${tempBadge.className}`}>
          {tempBadge.emoji} {tempBadge.label}
        </span>
        {/* Trend */}
        {trend === "heating" && (
          <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-300 dark:text-emerald-400">
            <TrendingUp className="h-3 w-3" /> Aquecendo
          </Badge>
        )}
        {trend === "cooling" && (
          <Badge variant="outline" className="gap-1 text-red-600 border-red-300 dark:text-red-400">
            <TrendingDown className="h-3 w-3" /> Esfriando
          </Badge>
        )}
        {trend === "stable" && (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <ArrowRight className="h-3 w-3" /> Estável
          </Badge>
        )}
      </div>

      <div className="relative">
        <Progress value={score} className="h-2" />
        <div className={`absolute inset-0 h-2 rounded-full ${progressColor} transition-all`} style={{ width: `${score}%` }} />
      </div>

      <p className="text-xs text-muted-foreground">
        Atualizado {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true, locale: ptBR })}
      </p>

      {/* Chart */}
      <div className="pt-2">
        <p className="text-xs font-medium text-muted-foreground mb-2">Evolução (14 dias)</p>
        {isLoadingHistory ? (
          <Skeleton className="h-32 w-full" />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={chartData}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
              <Tooltip
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
          <p className="text-xs text-muted-foreground text-center py-6">Sem dados no período</p>
        )}
      </div>

      <Separator />

      {/* Recent events */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Últimos eventos</p>
        {isLoadingEvents ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
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
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum evento registrado</p>
        )}
      </div>

      <Separator />

      {/* AI Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Resumo IA</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateSummary}
            disabled={!canGenerateSummary || generateSummary.isPending}
          >
            {generateSummary.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            {canGenerateSummary ? "Gerar resumo" : "Gerado recentemente"}
          </Button>
        </div>
        {aiSummary && (
          <Card className="border-primary/20">
            <CardContent className="p-3 text-sm whitespace-pre-wrap">{aiSummary}</CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

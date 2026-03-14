import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useLeadScore(leadId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Score events for timeline
  const { data: events = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ["lead_score_events", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from("lead_score_events")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!leadId && !!user,
  });

  // Score history for chart (last 14 days, daily aggregation)
  const { data: scoreHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ["lead_score_history", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data, error } = await supabase
        .from("lead_score_events")
        .select("score_delta, created_at")
        .eq("lead_id", leadId)
        .gte("created_at", fourteenDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Group by day and accumulate
      const dailyMap = new Map<string, number>();
      let running = 0;

      // Get base score before the 14-day window
      const { data: priorData } = await supabase
        .from("lead_score_events")
        .select("score_delta")
        .eq("lead_id", leadId)
        .lt("created_at", fourteenDaysAgo.toISOString());

      if (priorData) {
        running = priorData.reduce((sum, e) => sum + (e.score_delta || 0), 0);
      }

      for (const event of data || []) {
        const day = new Date(event.created_at).toISOString().slice(0, 10);
        running += event.score_delta || 0;
        dailyMap.set(day, Math.max(0, Math.min(100, running)));
      }

      // Fill missing days
      const result: { date: string; score: number }[] = [];
      const cursor = new Date(fourteenDaysAgo);
      let lastScore = Math.max(0, Math.min(100, priorData?.reduce((s, e) => s + (e.score_delta || 0), 0) || 0));

      for (let i = 0; i < 14; i++) {
        const day = cursor.toISOString().slice(0, 10);
        if (dailyMap.has(day)) {
          lastScore = dailyMap.get(day)!;
        }
        result.push({ date: day, score: lastScore });
        cursor.setDate(cursor.getDate() + 1);
      }

      return result;
    },
    enabled: !!leadId && !!user,
  });

  // Trend calculation
  const trend = (() => {
    if (scoreHistory.length < 6) return "stable";
    const recent3 = scoreHistory.slice(-3);
    const prior3 = scoreHistory.slice(-6, -3);
    const recentAvg = recent3.reduce((s, d) => s + d.score, 0) / 3;
    const priorAvg = prior3.reduce((s, d) => s + d.score, 0) / 3;
    const diff = recentAvg - priorAvg;
    if (diff > 3) return "heating";
    if (diff < -3) return "cooling";
    return "stable";
  })();

  // Generate AI summary
  const generateSummary = useMutation({
    mutationFn: async (lead: { id: string; name: string; score?: number; temperature?: string }) => {
      const { data, error } = await supabase.functions.invoke("summarize-lead", {
        body: { lead_id: lead.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  return {
    events,
    scoreHistory,
    trend,
    isLoadingEvents,
    isLoadingHistory,
    generateSummary,
  };
}

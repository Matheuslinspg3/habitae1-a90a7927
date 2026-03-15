/**
 * Hook for AI Billing Dashboard data
 */

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TokenUsageEvent, PricingConfig, BillingConfig } from "@/services/ai-billing/types";

// ─── Billing Config ───
export function useAiBillingConfig() {
  return useQuery({
    queryKey: ["ai-billing-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_billing_config")
        .select("*")
        .eq("id", "default")
        .single();
      if (error) throw error;
      return data as unknown as BillingConfig;
    },
  });
}

export function useUpdateBillingConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<BillingConfig>) => {
      const { error } = await supabase
        .from("ai_billing_config")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", "default");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-billing-config"] }),
  });
}

// ─── Usage Events ───
export function useAiUsageEvents(filters: {
  period?: number;
  userId?: string;
  provider?: string;
  model?: string;
  status?: string;
}) {
  const { period = 30, userId, provider, model, status } = filters;

  return useQuery({
    queryKey: ["ai-usage-events", period, userId, provider, model, status],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - period);

      let query = supabase
        .from("ai_token_usage_events")
        .select("*")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000);

      if (userId) query = query.eq("user_id", userId);
      if (provider) query = query.eq("provider", provider);
      if (model) query = query.eq("model", model);
      if (status) query = query.eq("request_status", status);

      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]) as TokenUsageEvent[];
    },
  });
}

// ─── Pricing ───
export function useAiBillingPricing() {
  return useQuery({
    queryKey: ["ai-billing-pricing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_billing_pricing")
        .select("*")
        .order("provider", { ascending: true });
      if (error) throw error;
      return (data as any[]) as PricingConfig[];
    },
  });
}

export function useUpdatePricing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pricing: Partial<PricingConfig> & { id: string }) => {
      const { id, ...rest } = pricing;
      const { error } = await supabase
        .from("ai_billing_pricing")
        .update({ ...rest, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-billing-pricing"] }),
  });
}

// ─── Aggregations ───
export function useUsageAggregations(events: TokenUsageEvent[] | undefined) {
  return useMemo(() => {
    if (!events || events.length === 0) {
      return {
        totalRequests: 0,
        totalTokens: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalProviderCost: 0,
        totalBilledAmount: 0,
        successRate: 0,
        byProvider: {} as Record<string, { count: number; tokens: number; cost: number; billed: number }>,
        byModel: {} as Record<string, { count: number; tokens: number; cost: number; billed: number }>,
        byDay: {} as Record<string, { count: number; tokens: number; cost: number }>,
        byUser: {} as Record<string, { count: number; tokens: number; cost: number; billed: number }>,
      };
    }

    const successCount = events.filter((e) => e.request_status === "success").length;

    const byProvider: Record<string, { count: number; tokens: number; cost: number; billed: number }> = {};
    const byModel: Record<string, { count: number; tokens: number; cost: number; billed: number }> = {};
    const byDay: Record<string, { count: number; tokens: number; cost: number }> = {};
    const byUser: Record<string, { count: number; tokens: number; cost: number; billed: number }> = {};

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalProviderCost = 0;
    let totalBilledAmount = 0;

    for (const e of events) {
      totalInputTokens += e.input_tokens || 0;
      totalOutputTokens += e.output_tokens || 0;
      totalProviderCost += Number(e.estimated_provider_cost) || 0;
      totalBilledAmount += Number(e.simulated_bill_amount) || 0;

      const tokens = (e.input_tokens || 0) + (e.output_tokens || 0);
      const cost = Number(e.estimated_provider_cost) || 0;
      const billed = Number(e.simulated_bill_amount) || 0;

      // by provider
      if (!byProvider[e.provider]) byProvider[e.provider] = { count: 0, tokens: 0, cost: 0, billed: 0 };
      byProvider[e.provider].count++;
      byProvider[e.provider].tokens += tokens;
      byProvider[e.provider].cost += cost;
      byProvider[e.provider].billed += billed;

      // by model
      const modelKey = `${e.provider}/${e.model}`;
      if (!byModel[modelKey]) byModel[modelKey] = { count: 0, tokens: 0, cost: 0, billed: 0 };
      byModel[modelKey].count++;
      byModel[modelKey].tokens += tokens;
      byModel[modelKey].cost += cost;
      byModel[modelKey].billed += billed;

      // by day
      const day = e.created_at?.split("T")[0] || "unknown";
      if (!byDay[day]) byDay[day] = { count: 0, tokens: 0, cost: 0 };
      byDay[day].count++;
      byDay[day].tokens += tokens;
      byDay[day].cost += cost;

      // by user
      if (!byUser[e.user_id]) byUser[e.user_id] = { count: 0, tokens: 0, cost: 0, billed: 0 };
      byUser[e.user_id].count++;
      byUser[e.user_id].tokens += tokens;
      byUser[e.user_id].cost += cost;
      byUser[e.user_id].billed += billed;
    }

    return {
      totalRequests: events.length,
      totalTokens: totalInputTokens + totalOutputTokens,
      totalInputTokens,
      totalOutputTokens,
      totalProviderCost,
      totalBilledAmount,
      successRate: events.length > 0 ? (successCount / events.length) * 100 : 0,
      byProvider,
      byModel,
      byDay,
      byUser,
    };
  }, [events]);
}

/**
 * AI Token Billing — Token Usage Tracker
 * Records AI usage events to the database.
 */

import { supabase } from "@/integrations/supabase/client";
import { calculateCost } from "./pricing-calculator";
import type { PricingConfig, TokenUsageEvent } from "./types";

// Cache pricing configs in memory
let pricingCache: PricingConfig[] | null = null;
let pricingCacheExpiry = 0;

async function getPricing(provider: string, model: string): Promise<PricingConfig | null> {
  const now = Date.now();
  if (!pricingCache || now > pricingCacheExpiry) {
    const { data } = await supabase
      .from("ai_billing_pricing")
      .select("*")
      .eq("is_active", true);
    pricingCache = (data as any[]) || [];
    pricingCacheExpiry = now + 5 * 60 * 1000; // 5 min cache
  }

  return pricingCache.find(
    (p) => p.provider === provider && p.model === model
  ) || null;
}

export interface TrackTokenUsageParams {
  userId: string;
  organizationId?: string;
  provider: string;
  model: string;
  functionName?: string;
  inputTokens: number;
  outputTokens: number;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records an AI token usage event with calculated costs.
 * Safe to call — errors are caught and logged, never thrown.
 */
export async function trackTokenUsage(params: TrackTokenUsageParams): Promise<string | null> {
  try {
    const pricing = await getPricing(params.provider, params.model);
    const cost = calculateCost(params.inputTokens, params.outputTokens, pricing);

    const event: Record<string, unknown> = {
      user_id: params.userId,
      organization_id: params.organizationId || null,
      provider: params.provider,
      model: params.model,
      function_name: params.functionName || null,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      estimated_provider_cost: cost.provider_cost,
      markup_percentage: pricing?.markup_percentage ?? 30,
      currency: cost.currency,
      request_status: params.success ? "success" : "error",
      error_message: params.errorMessage || null,
      stripe_sync_status: "pending",
      metadata: params.metadata || null,
    };

    const { data, error } = await supabase
      .from("ai_token_usage_events")
      .insert(event as any)
      .select("id")
      .single();

    if (error) {
      console.error("[ai-billing] Failed to track usage:", error.message);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error("[ai-billing] trackTokenUsage error:", err);
    return null;
  }
}

/**
 * Invalidates the pricing cache (call after admin updates pricing).
 */
export function invalidatePricingCache() {
  pricingCache = null;
  pricingCacheExpiry = 0;
}

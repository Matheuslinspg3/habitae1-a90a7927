/**
 * Shared helper for AI token billing tracking.
 * Logs usage events to ai_token_usage_events with cost calculation.
 * 
 * Usage in Edge Functions:
 *   import { trackAiBilling } from "../_shared/ai-billing.ts";
 *   await trackAiBilling(supabaseServiceClient, { ... });
 */

// Pricing per 1k tokens (USD) — matches ai_billing_pricing table defaults
const PRICING_PER_1K: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-5": { input: 0.005, output: 0.015 },
  "gpt-5-mini": { input: 0.001, output: 0.004 },
  "gpt-image-1": { input: 0.04, output: 0 },
  "google/gemini-2.5-flash": { input: 0.00015, output: 0.0006 },
  "google/gemini-2.5-flash-lite": { input: 0.0001, output: 0.0004 },
  "google/gemini-2.5-pro": { input: 0.00125, output: 0.005 },
  "google/gemini-3-flash-preview": { input: 0.00015, output: 0.0006 },
  "google/gemini-3-pro-image-preview": { input: 0.005, output: 0 },
  "google/gemini-3.1-flash-image-preview": { input: 0.003, output: 0 },
  "gemini-2.0-flash": { input: 0.0001, output: 0.0004 },
  "gemini-3-pro-image-preview": { input: 0.005, output: 0 },
  "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
  "llama-3.3-70b-versatile": { input: 0.00059, output: 0.00079 },
  "stable-diffusion-xl-1024-v1-0": { input: 0.002, output: 0 },
  "leonardo-diffusion-xl": { input: 0.005, output: 0 },
};

const DEFAULT_MARKUP = 30; // 30% markup

function estimateCostPerModel(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING_PER_1K[model];
  if (!p) return 0;
  return (inputTokens / 1000) * p.input + (outputTokens / 1000) * p.output;
}

export interface AiBillingParams {
  userId: string;
  organizationId?: string | null;
  provider: string;
  model: string;
  functionName: string;
  inputTokens: number;
  outputTokens: number;
  success: boolean;
  errorMessage?: string | null;
  usageType?: string; // "text" | "image" | "image_edit" | "vision" | "audio"
  metadata?: Record<string, unknown>;
}

/**
 * Records an AI usage event to ai_token_usage_events for billing tracking.
 * Safe to call — never throws. Errors are logged silently.
 */
export async function trackAiBilling(supabase: any, params: AiBillingParams): Promise<void> {
  try {
    // Check if billing is enabled
    const { data: config } = await supabase
      .from("ai_billing_config")
      .select("billing_enabled")
      .eq("id", "default")
      .maybeSingle();

    // If billing not enabled or table doesn't exist, silently skip
    if (!config?.billing_enabled) return;

    const cost = estimateCostPerModel(params.model, params.inputTokens, params.outputTokens);

    // For image generation, use a flat cost estimate if no tokens
    const effectiveCost = cost > 0 ? cost : (
      params.usageType?.startsWith("image") ? estimateImageCost(params.provider) : 0
    );

    await supabase.from("ai_token_usage_events").insert({
      user_id: params.userId,
      organization_id: params.organizationId || null,
      provider: params.provider,
      model: params.model,
      function_name: params.functionName,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      estimated_provider_cost: effectiveCost,
      markup_percentage: DEFAULT_MARKUP,
      currency: "USD",
      request_status: params.success ? "success" : "error",
      error_message: params.errorMessage || null,
      stripe_sync_status: "pending",
      metadata: params.metadata || null,
    });
  } catch (err) {
    // Never throw — billing tracking must not break the AI feature
    console.warn("[ai-billing] Failed to track:", err);
  }
}

function estimateImageCost(provider: string): number {
  const costs: Record<string, number> = {
    openai: 0.04,      // gpt-image-1 per image
    gemini: 0.005,     // Gemini image gen
    stability: 0.002,  // SDXL
    leonardo: 0.005,   // Leonardo
    flux: 0.006,       // Flux Pro
  };
  return costs[provider] || 0.005;
}

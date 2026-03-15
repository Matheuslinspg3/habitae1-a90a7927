/**
 * AI Token Billing — Pricing Calculator
 * Calculates costs based on token usage and pricing config.
 */

import type { PricingConfig, CostCalculation } from "./types";

const DEFAULT_MARKUP = 30;

export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: PricingConfig | null,
  overrideMarkup?: number
): CostCalculation {
  if (!pricing) {
    // Fallback: zero cost if no pricing found
    return {
      provider_cost: 0,
      markup_amount: 0,
      fixed_margin: 0,
      total_billed: 0,
      currency: "USD",
    };
  }

  const inputCost = (inputTokens / 1000) * pricing.price_per_1k_input_tokens;
  const outputCost = (outputTokens / 1000) * pricing.price_per_1k_output_tokens;
  const providerCost = inputCost + outputCost;

  const markup = overrideMarkup ?? pricing.markup_percentage ?? DEFAULT_MARKUP;
  const markupAmount = providerCost * (markup / 100);
  const fixedMargin = pricing.fixed_margin ?? 0;

  return {
    provider_cost: providerCost,
    markup_amount: markupAmount,
    fixed_margin: fixedMargin,
    total_billed: providerCost + markupAmount + fixedMargin,
    currency: pricing.currency || "USD",
  };
}

/**
 * Formats a USD amount to BRL estimate
 */
export function usdToBrl(usd: number, rate = 5.5): number {
  return usd * rate;
}

/**
 * Formats cost for display
 */
export function formatCost(amount: number, currency = "USD"): string {
  if (currency === "BRL") {
    return `R$ ${amount.toFixed(4)}`;
  }
  return `$${amount.toFixed(6)}`;
}

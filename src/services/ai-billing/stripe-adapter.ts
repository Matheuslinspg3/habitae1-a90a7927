/**
 * AI Token Billing — Stripe Adapter (Sandbox/Mock)
 * 
 * Abstraction layer for Stripe metered billing.
 * In sandbox mode, this records events locally.
 * When Stripe test keys are configured, it sends meter events to Stripe.
 */

import { supabase } from "@/integrations/supabase/client";

export type BillingMode = "mock" | "stripe_test" | "stripe_live";

interface MeterEvent {
  eventId: string;
  userId: string;
  totalTokens: number;
  billedAmount: number;
  currency: string;
  timestamp: string;
}

/**
 * Gets the current billing mode from config.
 */
export async function getBillingMode(): Promise<BillingMode> {
  try {
    const { data } = await supabase
      .from("ai_billing_config")
      .select("billing_enabled, sandbox_mode, stripe_test_mode")
      .eq("id", "default")
      .single();

    if (!data || !data.billing_enabled) return "mock";
    if (data.sandbox_mode || data.stripe_test_mode) return "stripe_test";
    return "stripe_live";
  } catch {
    return "mock";
  }
}

/**
 * Sends a meter event to Stripe (or mock).
 * In mock mode, just updates the local record.
 */
export async function sendMeterEvent(event: MeterEvent): Promise<{ success: boolean; mode: BillingMode; stripeEventId?: string }> {
  const mode = await getBillingMode();

  if (mode === "mock") {
    // Mock: just mark as synced locally
    await supabase
      .from("ai_token_usage_events")
      .update({
        stripe_sync_status: "mock_synced",
        stripe_meter_event_id: `mock_${event.eventId}`,
      } as any)
      .eq("id", event.eventId);

    return { success: true, mode, stripeEventId: `mock_${event.eventId}` };
  }

  if (mode === "stripe_test") {
    // Call Edge Function for Stripe test mode
    try {
      const { data, error } = await supabase.functions.invoke("ai-billing-stripe", {
        body: {
          action: "create_meter_event",
          event,
        },
      });

      if (error) throw error;

      // Update local record
      await supabase
        .from("ai_token_usage_events")
        .update({
          stripe_sync_status: "synced",
          stripe_meter_event_id: data?.stripe_event_id || null,
        } as any)
        .eq("id", event.eventId);

      return { success: true, mode, stripeEventId: data?.stripe_event_id };
    } catch (err) {
      console.error("[ai-billing] Stripe sync failed, falling back to mock:", err);
      
      // Fallback: mark as failed
      await supabase
        .from("ai_token_usage_events")
        .update({ stripe_sync_status: "failed" } as any)
        .eq("id", event.eventId);

      return { success: false, mode };
    }
  }

  // stripe_live — not implemented yet
  return { success: false, mode };
}

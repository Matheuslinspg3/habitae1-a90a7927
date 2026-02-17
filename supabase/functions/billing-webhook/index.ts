import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";

serve(async (req) => {
  const log = createLogger("billing-webhook", req);

  if (req.method !== "POST") {
    log.warn("Method not allowed", { method: req.method });
    return new Response("Method not allowed", { status: 405 });
  }

  // A02: Validate Asaas webhook token
  const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const receivedToken = req.headers.get("asaas-access-token");
  if (!expectedToken || receivedToken !== expectedToken) {
    log.error("Unauthorized webhook request", { has_token: !!receivedToken });
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const payload = await req.json();
    const event = payload.event;
    const paymentId = payload.payment?.id;
    const subscriptionId = payload.payment?.subscription;

    const providerEventId = payload.id || `${event}_${paymentId || 'noid'}`;

    log.info("Webhook received", { event, payment_id: paymentId, subscription_id: subscriptionId, provider_event_id: providerEventId });

    // A03: Sanitize payload — only persist non-sensitive fields
    const sanitizedMeta = {
      event,
      payment_id: paymentId || null,
      subscription_id: subscriptionId || null,
      billing_type: payload.payment?.billingType || null,
      value: payload.payment?.value || null,
      status: payload.payment?.status || null,
    };

    // A04: Compute payload hash for deduplication
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(payload)));
    const payloadHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // A02: Check idempotency — skip if already processed
    const { data: existing } = await supabase
      .from("billing_webhook_logs")
      .select("id, processed")
      .eq("provider_event_id", providerEventId)
      .maybeSingle();

    if (existing?.processed) {
      log.info("Duplicate event skipped", { provider_event_id: providerEventId });
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // A03: Log webhook with sanitized payload (no PII)
    const { data: logEntry } = await supabase.from("billing_webhook_logs").insert({
      provider: "asaas",
      event_type: event,
      payload: sanitizedMeta,
      provider_event_id: providerEventId,
      event_status: payload.payment?.status || null,
      payload_hash: payloadHash,
    }).select("id").single();

    if (!paymentId) {
      if (logEntry?.id) {
        await supabase.from("billing_webhook_logs")
          .update({ processed: true })
          .eq("id", logEntry.id);
      }
      log.info("No payment id, marked processed");
      return new Response(JSON.stringify({ ok: true, msg: "No payment id" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Find subscription
    let sub: { id: string; organization_id: string } | null = null;
    if (subscriptionId) {
      const { data } = await supabase
        .from("subscriptions")
        .select("id, organization_id")
        .eq("provider_subscription_id", subscriptionId)
        .maybeSingle();
      sub = data;
    }
    if (!sub) {
      const { data: payment } = await supabase
        .from("billing_payments")
        .select("subscription_id, organization_id")
        .eq("provider_payment_id", paymentId)
        .maybeSingle();
      if (payment?.subscription_id) {
        sub = { id: payment.subscription_id, organization_id: payment.organization_id };
      }
    }

    // Process events
    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      log.info("Payment confirmed", { payment_id: paymentId, subscription_found: !!sub });
      if (sub) {
        await supabase.from("subscriptions")
          .update({ status: "active" })
          .eq("id", sub.id);
      }
      await supabase.from("billing_payments")
        .update({ status: "confirmed", paid_at: new Date().toISOString() })
        .eq("provider_payment_id", paymentId);

      if (sub && payload.payment?.value) {
        await supabase.from("billing_payments").upsert({
          organization_id: sub.organization_id,
          subscription_id: sub.id,
          provider: "asaas",
          provider_payment_id: paymentId,
          amount_cents: Math.round(payload.payment.value * 100),
          method: (payload.payment.billingType || "").toLowerCase(),
          status: "confirmed",
          paid_at: new Date().toISOString(),
          invoice_url: payload.payment.invoiceUrl || null,
        }, { onConflict: "provider_payment_id" });
      }
    }

    if (event === "PAYMENT_OVERDUE") {
      log.warn("Payment overdue", { payment_id: paymentId, subscription_found: !!sub });
      if (sub) {
        await supabase.from("subscriptions")
          .update({ status: "overdue" })
          .eq("id", sub.id);
      }
      await supabase.from("billing_payments")
        .update({ status: "failed" })
        .eq("provider_payment_id", paymentId);
    }

    if (event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
      log.info("Payment refunded/deleted", { payment_id: paymentId, event });
      await supabase.from("billing_payments")
        .update({ status: "refunded" })
        .eq("provider_payment_id", paymentId);
    }

    if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") {
      log.info("Subscription cancelled", { subscription_found: !!sub, event });
      if (sub) {
        await supabase.from("subscriptions")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", sub.id);
      }
    }

    // A04: Mark webhook as processed
    if (logEntry?.id) {
      await supabase.from("billing_webhook_logs")
        .update({ processed: true })
        .eq("id", logEntry.id);
    }

    log.info("Webhook processed successfully", { event, provider_event_id: providerEventId });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    log.error("Webhook processing failed", { error_type: error instanceof Error ? error.constructor.name : "unknown" });

    await supabase.from("billing_webhook_logs").insert({
      provider: "asaas",
      event_type: "ERROR",
      payload: { error_type: "processing_failure" },
      error_message: "Webhook processing failed",
    });

    return new Response(JSON.stringify({ error: "Processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

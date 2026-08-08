import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";

const WEBHOOK_WINDOW_MINUTES = Number(Deno.env.get("ASAAS_WEBHOOK_WINDOW_MINUTES") || "30");

function getRequestIp(req: Request): string | null {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) return xForwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip");
}

function ipV4ToInt(ip: string): number | null {
  const octets = ip.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((v) => Number.isNaN(v) || v < 0 || v > 255)) return null;
  return octets.reduce((acc, val) => ((acc << 8) | val) >>> 0, 0);
}

function isIpAllowed(ip: string | null, allowlistRaw: string): boolean {
  const allowlist = allowlistRaw.split(",").map((value) => value.trim()).filter(Boolean);
  if (allowlist.length === 0) return true;
  if (!ip) return false;

  for (const allowed of allowlist) {
    if (allowed === ip) return true;

    const [base, bits] = allowed.split("/");
    if (!bits) continue;

    const ipInt = ipV4ToInt(ip);
    const baseInt = ipV4ToInt(base);
    const cidrBits = Number(bits);
    if (ipInt === null || baseInt === null || Number.isNaN(cidrBits) || cidrBits < 0 || cidrBits > 32) continue;

    const mask = cidrBits === 0 ? 0 : (0xffffffff << (32 - cidrBits)) >>> 0;
    if ((ipInt & mask) === (baseInt & mask)) return true;
  }
  return false;
}

async function verifyHmacSignature(rawBody: string, receivedSignature: string, secret: string): Promise<boolean> {
  const keyData = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(signatureBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === receivedSignature.toLowerCase();
}

function parseEventDate(payload: Record<string, unknown>): Date | null {
  const payment = (payload.payment && typeof payload.payment === "object") ? payload.payment as Record<string, unknown> : {};
  const candidates = [
    payload.dateCreated,
    payment.dateCreated,
    payment.clientPaymentDate,
    payment.confirmedDate,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

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

  // Additional origin authenticity checks (allowlist IP + optional HMAC)
  const requestIp = getRequestIp(req);
  const ipAllowlist = Deno.env.get("ASAAS_WEBHOOK_IP_ALLOWLIST") || "";
  if (!isIpAllowed(requestIp, ipAllowlist)) {
    log.error("Webhook rejected by IP allowlist", { request_ip: requestIp });
    return new Response("Forbidden", { status: 403 });
  }

  const rawBody = await req.text();
  const hmacSecret = Deno.env.get("ASAAS_WEBHOOK_HMAC_SECRET") || "";
  if (hmacSecret) {
    const receivedHmac = req.headers.get("asaas-signature") || req.headers.get("x-asaas-signature") || "";
    if (!receivedHmac || !(await verifyHmacSignature(rawBody, receivedHmac, hmacSecret))) {
      log.error("Webhook signature validation failed", { has_signature: !!receivedHmac });
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const paymentId = payload.payment?.id;
    const subscriptionId = payload.payment?.subscription;
    const eventDate = parseEventDate(payload);
    const receivedAt = new Date();
    const eventAgeMs = eventDate ? (receivedAt.getTime() - eventDate.getTime()) : 0;

    if (eventDate && eventAgeMs > WEBHOOK_WINDOW_MINUTES * 60 * 1000) {
      log.warn("Stale event rejected", { event, payment_id: paymentId, event_date: eventDate.toISOString() });
      return new Response(JSON.stringify({ ok: false, error: "stale_event" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

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
      .select("id, processed, received_at")
      .eq("provider", "asaas")
      .eq("provider_event_id", providerEventId)
      .eq("provider_payment_id", paymentId || "")
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const existingTime = existing.received_at ? new Date(existing.received_at).getTime() : null;
      const duplicateAgeMs = existingTime ? (receivedAt.getTime() - existingTime) : null;
      if (duplicateAgeMs !== null && duplicateAgeMs > WEBHOOK_WINDOW_MINUTES * 60 * 1000) {
        log.warn("Duplicate outside acceptance window", { provider_event_id: providerEventId, payment_id: paymentId });
        return new Response(JSON.stringify({ ok: false, error: "duplicate_outside_window" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (existing.processed) {
        log.info("Duplicate event skipped", { provider_event_id: providerEventId });
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // A03: Log webhook with sanitized payload (no PII)
    const { data: logEntry, error: logError } = await supabase.from("billing_webhook_logs").insert({
      provider: "asaas",
      event_type: event,
      payload: sanitizedMeta,
      provider_event_id: providerEventId,
      provider_payment_id: paymentId || "",
      event_status: payload.payment?.status || null,
      payload_hash: payloadHash,
      received_at: receivedAt.toISOString(),
    }).select("id").single();

    if (logError && logError.code === "23505") {
      log.info("Webhook duplicate prevented by unique constraint", { provider_event_id: providerEventId, payment_id: paymentId });
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (logError) throw logError;

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

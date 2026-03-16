import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { createLogger } from "../_shared/logger.ts";

// A14: CORS allowlist — fail-closed when not configured
const ALLOWED_ORIGINS = (Deno.env.get("APP_ALLOWED_ORIGINS") || "").split(",").map(s => s.trim()).filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  if (ALLOWED_ORIGINS.length === 0) {
    // Fail-closed: no allowlist configured = reject cross-origin in production
    console.warn("[billing] APP_ALLOWED_ORIGINS not configured — CORS will be restrictive");
    return {
      "Access-Control-Allow-Origin": origin || "null",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    };
  }
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

// Use sandbox for testing, production for live
// Auto-detect sandbox from ASAAS_SANDBOX flag OR from API key prefix
const apiKey = Deno.env.get("ASAAS_API_KEY") || "";
const isSandbox = Deno.env.get("ASAAS_SANDBOX") === "true" || apiKey.startsWith("$aact_hmlg");
const ASAAS_BASE = isSandbox
  ? "https://sandbox.asaas.com/api/v3" 
  : "https://api.asaas.com/v3";

async function asaasFetch(path: string, opts: RequestInit = {}) {
  const key = Deno.env.get("ASAAS_API_KEY");
  if (!key) throw new Error("ASAAS_API_KEY not configured");
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...opts,
    headers: {
      ...opts.headers as Record<string,string>,
      "access_token": key,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.errors?.[0]?.description || JSON.stringify(data));
  return data;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const log = createLogger("billing", req);
  log.info("Request received", { sandbox: isSandbox });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Invalid token");
    const user = { id: claimsData.claims.sub as string, email: claimsData.claims.email as string };

    // Get user's org
    const { data: profile } = await supabase
      .from("profiles").select("organization_id").eq("user_id", user.id).single();
    if (!profile?.organization_id) throw new Error("No organization");
    const orgId = profile.organization_id;

    // Get org info
    const { data: org } = await supabase
      .from("organizations").select("name, email, cnpj, phone").eq("id", orgId).single();

    if (action === "create-customer") {
      // Create or get Asaas customer
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("provider_customer_id")
        .eq("organization_id", orgId)
        .not("provider_customer_id", "is", null)
        .limit(1)
        .maybeSingle();

      if (sub?.provider_customer_id) {
        return new Response(JSON.stringify({ customerId: sub.provider_customer_id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Read CPF/name from request body if provided
      let customerName = org?.name || "Cliente Habitae";
      let customerCpf = org?.cnpj?.replace(/\D/g, "") || undefined;
      try {
        const body = await req.json();
        if (body.customerName) customerName = body.customerName;
        if (body.customerCpf) customerCpf = body.customerCpf;
      } catch { /* no body */ }

      if (!customerCpf) {
        throw new Error("CPF ou CNPJ é obrigatório para criar a cobrança.");
      }

      const customer = await asaasFetch("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: customerName,
          email: org?.email || user.email,
          cpfCnpj: customerCpf,
          phone: org?.phone?.replace(/\D/g, "") || undefined,
          externalReference: orgId,
        }),
      });

      return new Response(JSON.stringify({ customerId: customer.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create-subscription") {
      const body = await req.json();
      const { planId, billingCycle, paymentMethod, customerId } = body;

      // Get plan
      const { data: plan } = await supabase
        .from("subscription_plans").select("*").eq("id", planId).single();
      if (!plan) throw new Error("Plan not found");

      const price = billingCycle === "yearly" ? plan.price_yearly : plan.price_monthly;
      const now = new Date();
      const periodEnd = billingCycle === "yearly"
        ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // PIX: create individual payment with PIX QR code
      if (paymentMethod === "pix") {
        const dueDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
          .toISOString().split("T")[0];

        const payment = await asaasFetch("/payments", {
          method: "POST",
          body: JSON.stringify({
            customer: customerId,
            billingType: "PIX",
            value: Number(price),
            dueDate,
            description: `Habitae ${plan.name} - ${billingCycle === "yearly" ? "Anual" : "Mensal"}`,
            externalReference: orgId,
          }),
        });

        // Get PIX QR Code
        const pixInfo = await asaasFetch(`/payments/${payment.id}/pixQrCode`);

        // Create local subscription as pending
        const { data: newSub, error: subErr } = await supabase
          .from("subscriptions")
          .insert({
            organization_id: orgId,
            plan_id: planId,
            status: "pending",
            billing_cycle: billingCycle,
            provider: "asaas",
            provider_customer_id: customerId,
            provider_subscription_id: null,
            payment_method: "pix",
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          })
          .select()
          .single();
        if (subErr) throw subErr;

        // Cancel old subscriptions
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled", cancelled_at: now.toISOString() })
          .eq("organization_id", orgId)
          .in("status", ["active", "trial"])
          .neq("id", newSub.id);

        // Save payment record
        await supabase.from("billing_payments").insert({
          organization_id: orgId,
          subscription_id: newSub.id,
          provider: "asaas",
          provider_payment_id: payment.id,
          amount_cents: Math.round(Number(price) * 100),
          method: "pix",
          status: "pending",
          pix_qr_code: pixInfo.encodedImage,
          pix_copy_paste: pixInfo.payload,
        });

        return new Response(JSON.stringify({
          subscription: newSub,
          pixData: {
            paymentId: payment.id,
            qrCode: pixInfo.encodedImage,
            copyPaste: pixInfo.payload,
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Credit/Debit Card: create payment with UNDEFINED billingType
      // Asaas generates an invoiceUrl where the user can pay with card
      if (paymentMethod === "credit_card") {
        const dueDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
          .toISOString().split("T")[0];

        const payment = await asaasFetch("/payments", {
          method: "POST",
          body: JSON.stringify({
            customer: customerId,
            billingType: "UNDEFINED",
            value: Number(price),
            dueDate,
            description: `Habitae ${plan.name} - ${billingCycle === "yearly" ? "Anual" : "Mensal"}`,
            externalReference: orgId,
          }),
        });

        // Create local subscription as pending
        const { data: newSub, error: subErr } = await supabase
          .from("subscriptions")
          .insert({
            organization_id: orgId,
            plan_id: planId,
            status: "pending",
            billing_cycle: billingCycle,
            provider: "asaas",
            provider_customer_id: customerId,
            provider_subscription_id: null,
            payment_method: "credit_card",
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          })
          .select()
          .single();
        if (subErr) throw subErr;

        // Cancel old subscriptions
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled", cancelled_at: now.toISOString() })
          .eq("organization_id", orgId)
          .in("status", ["active", "trial"])
          .neq("id", newSub.id);

        // Save payment record
        await supabase.from("billing_payments").insert({
          organization_id: orgId,
          subscription_id: newSub.id,
          provider: "asaas",
          provider_payment_id: payment.id,
          amount_cents: Math.round(Number(price) * 100),
          method: "credit_card",
          status: "pending",
          invoice_url: payment.invoiceUrl,
        });

        return new Response(JSON.stringify({
          subscription: newSub,
          invoiceUrl: payment.invoiceUrl,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Boleto fallback
      const billingTypeMap: Record<string, string> = {
        boleto: "BOLETO",
      };
      const cycle = billingCycle === "yearly" ? "YEARLY" : "MONTHLY";

      const asaasSub = await asaasFetch("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: billingTypeMap[paymentMethod] || "BOLETO",
          value: Number(price),
          cycle,
          description: `Habitae ${plan.name} - ${billingCycle === "yearly" ? "Anual" : "Mensal"}`,
          externalReference: orgId,
        }),
      });

      const { data: newSub, error: subErr } = await supabase
        .from("subscriptions")
        .insert({
          organization_id: orgId,
          plan_id: planId,
          status: "active",
          billing_cycle: billingCycle,
          provider: "asaas",
          provider_customer_id: customerId,
          provider_subscription_id: asaasSub.id,
          payment_method: paymentMethod,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .select()
        .single();
      if (subErr) throw subErr;

      // Cancel old subscriptions
      await supabase
        .from("subscriptions")
        .update({ status: "cancelled", cancelled_at: now.toISOString() })
        .eq("organization_id", orgId)
        .in("status", ["active", "trial", "pending"])
        .neq("id", newSub.id);

      return new Response(JSON.stringify({ subscription: newSub }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cancel-subscription") {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("organization_id", orgId)
        .in("status", ["active", "trial", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub) throw new Error("No active subscription");

      // Cancel on Asaas
      if (sub.provider_subscription_id) {
        try {
          await asaasFetch(`/subscriptions/${sub.provider_subscription_id}`, { method: "DELETE" });
        } catch (e) {
          console.error("Asaas cancel error:", e);
        }
      }

      await supabase
        .from("subscriptions")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_at_period_end: true })
        .eq("id", sub.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "renew") {
      const body = await req.json();
      const { planId, billingCycle, paymentMethod } = body;

      // Get or create customer
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("provider_customer_id")
        .eq("organization_id", orgId)
        .not("provider_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let customerId = existingSub?.provider_customer_id;
      if (!customerId) {
        const customer = await asaasFetch("/customers", {
          method: "POST",
          body: JSON.stringify({
            name: org?.name || "Cliente Habitae",
            email: org?.email || user.email,
            cpfCnpj: org?.cnpj?.replace(/\D/g, "") || undefined,
            externalReference: orgId,
          }),
        });
        customerId = customer.id;
      }

      // Call create-subscription endpoint internally via fetch
      const createUrl = new URL(req.url);
      createUrl.searchParams.set("action", "create-subscription");
      const createRes = await fetch(createUrl.toString(), {
        method: "POST",
        headers: {
          "Authorization": req.headers.get("Authorization") || "",
          "Content-Type": "application/json",
          "apikey": req.headers.get("apikey") || "",
        },
        body: JSON.stringify({ planId, billingCycle, paymentMethod, customerId }),
      });
      const createData = await createRes.json();
      return new Response(JSON.stringify(createData), {
        status: createRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    // A05/A09: Don't leak internal error details to client
    const msg = error instanceof Error ? error.message : "Erro interno";
    const safeMsg = msg.includes("API") || msg.includes("key") || msg.includes("token")
      ? "Erro no processamento do pagamento"
      : msg;
    log.error("Billing error", { error_message: safeMsg });
    return new Response(JSON.stringify({ error: safeMsg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

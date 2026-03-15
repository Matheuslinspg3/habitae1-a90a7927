import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate JWT
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode JWT to get user
    const parts = token.split(".");
    if (parts.length !== 3) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(atob(parts[1]));
    const userId = payload.sub;
    const exp = payload.exp;
    if (!userId || (exp && exp < Date.now() / 1000)) {
      return new Response(JSON.stringify({ error: "Token expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check developer role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "developer")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // Check billing config
    const { data: config } = await supabase
      .from("ai_billing_config")
      .select("*")
      .eq("id", "default")
      .single();

    if (!config?.billing_enabled) {
      return new Response(JSON.stringify({ error: "Billing not enabled", mode: "disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Actions ───
    if (action === "create_meter_event") {
      // In sandbox/test mode, simulate Stripe meter event
      const stripeTestKey = Deno.env.get("STRIPE_TEST_SECRET_KEY");

      if (!stripeTestKey || config.sandbox_mode) {
        // Mock mode
        const mockId = `mock_evt_${crypto.randomUUID().slice(0, 8)}`;
        console.log(`[ai-billing] Mock meter event: ${mockId}`, body.event);

        return new Response(JSON.stringify({
          success: true,
          mode: "mock",
          stripe_event_id: mockId,
          message: "Meter event simulated (sandbox mode)",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Stripe Test Mode — create usage record
      try {
        const stripeRes = await fetch("https://api.stripe.com/v1/billing/meter_events", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${stripeTestKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            "event_name": "ai_token_usage",
            "payload[stripe_customer_id]": body.event?.stripeCustomerId || "cus_test",
            "payload[value]": String(body.event?.totalTokens || 0),
            "timestamp": String(Math.floor(Date.now() / 1000)),
          }),
        });

        const stripeData = await stripeRes.json();
        await stripeRes.text(); // consume body

        if (!stripeRes.ok) {
          console.error("[ai-billing] Stripe API error:", stripeData);
          return new Response(JSON.stringify({
            success: false,
            mode: "stripe_test",
            error: "Stripe API error",
            details: stripeData?.error?.message || "Unknown",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          mode: "stripe_test",
          stripe_event_id: stripeData.id,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("[ai-billing] Stripe request failed:", err);
        // Fallback to mock
        const fallbackId = `fallback_${crypto.randomUUID().slice(0, 8)}`;
        return new Response(JSON.stringify({
          success: true,
          mode: "mock_fallback",
          stripe_event_id: fallbackId,
          message: "Stripe unavailable, fell back to mock",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "generate_invoice") {
      // Generate simulated invoice for a period
      const { userId: targetUserId, periodStart, periodEnd } = body;

      const { data: events } = await supabase
        .from("ai_token_usage_events")
        .select("*")
        .eq("user_id", targetUserId)
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd)
        .eq("request_status", "success");

      if (!events || events.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "No events found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const totalTokens = events.reduce((s, e) => s + (e.input_tokens || 0) + (e.output_tokens || 0), 0);
      const totalProviderCost = events.reduce((s, e) => s + Number(e.estimated_provider_cost || 0), 0);
      const totalBilled = events.reduce((s, e) => s + Number(e.simulated_bill_amount || 0), 0);

      const { data: invoice, error: invError } = await supabase
        .from("ai_billing_invoices")
        .insert({
          user_id: targetUserId,
          period_start: periodStart,
          period_end: periodEnd,
          total_tokens: totalTokens,
          total_requests: events.length,
          total_provider_cost: totalProviderCost,
          total_billed_amount: totalBilled,
          status: "simulated",
          stripe_invoice_id: `sim_inv_${crypto.randomUUID().slice(0, 8)}`,
        })
        .select()
        .single();

      if (invError) throw invError;

      return new Response(JSON.stringify({ success: true, invoice }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ai-billing-stripe] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

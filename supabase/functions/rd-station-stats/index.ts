import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Authenticate user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's org
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "No organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get RD Station settings with API keys
    const { data: settings } = await supabase
      .from("rd_station_settings")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .single();

    if (!settings?.api_private_key) {
      return new Response(
        JSON.stringify({ error: "API keys not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiToken = settings.api_private_key;
    const baseUrl = "https://api.rd.services";

    // Fetch multiple endpoints in parallel
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString();
    const endDate = now.toISOString();

    const headers = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };

    // Parallel API calls
    const [funnelRes, emailsRes, conversionsRes] = await Promise.allSettled([
      fetch(`${baseUrl}/platform/analytics/funnel?start_date=${startDate}&end_date=${endDate}`, { headers }),
      fetch(`${baseUrl}/platform/analytics/emails?start_date=${startDate}&end_date=${endDate}`, { headers }),
      fetch(`${baseUrl}/platform/contacts?limit=1&order=created_at:desc`, { headers }),
    ]);

    const stats: Record<string, any> = {
      period: { start: startDate, end: endDate },
      funnel: null,
      emails: null,
      contacts: null,
    };

    // Process funnel
    if (funnelRes.status === "fulfilled" && funnelRes.value.ok) {
      stats.funnel = await funnelRes.value.json();
    } else if (funnelRes.status === "fulfilled") {
      stats.funnel = { error: `Status ${funnelRes.value.status}` };
    }

    // Process emails
    if (emailsRes.status === "fulfilled" && emailsRes.value.ok) {
      stats.emails = await emailsRes.value.json();
    } else if (emailsRes.status === "fulfilled") {
      stats.emails = { error: `Status ${emailsRes.value.status}` };
    }

    // Process contacts (just to get total count)
    if (conversionsRes.status === "fulfilled" && conversionsRes.value.ok) {
      stats.contacts = await conversionsRes.value.json();
    } else if (conversionsRes.status === "fulfilled") {
      stats.contacts = { error: `Status ${conversionsRes.value.status}` };
    }

    // Internal CRM stats: leads from RD Station
    const { count: rdLeadsTotal } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id)
      .eq("external_source", "rdstation");

    const { count: rdLeadsMonth } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id)
      .eq("external_source", "rdstation")
      .gte("created_at", startDate);

    const { count: webhooksTotal } = await supabase
      .from("rd_station_webhook_logs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id);

    const { count: webhooksMonth } = await supabase
      .from("rd_station_webhook_logs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id)
      .gte("created_at", startDate);

    stats.internal = {
      rd_leads_total: rdLeadsTotal || 0,
      rd_leads_month: rdLeadsMonth || 0,
      webhooks_total: webhooksTotal || 0,
      webhooks_month: webhooksMonth || 0,
    };

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("RD Station stats error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

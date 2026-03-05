import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const orgId = profile.organization_id;

    // Get RD Station settings
    const { data: settings } = await supabase
      .from("rd_station_settings")
      .select("*")
      .eq("organization_id", orgId)
      .single();

    // Determine auth method: OAuth (preferred) or Private Token (fallback)
    let accessToken = settings?.oauth_access_token;
    const privateToken = settings?.api_private_key;

    if (!accessToken && !privateToken) {
      return new Response(
        JSON.stringify({
          error: "Conecte sua conta RD Station via OAuth ou configure a chave de API privada.",
          needs_oauth: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If OAuth, check expiration and refresh if needed
    if (accessToken && settings?.oauth_token_expires_at) {
      const expiresAt = new Date(settings.oauth_token_expires_at);
      if (expiresAt < new Date()) {
        const refreshResult = await refreshOAuthToken(supabase, settings, orgId);
        if (refreshResult.error) {
          // Fallback to private token if available
          if (privateToken) {
            accessToken = null; // will use privateToken below
          } else {
            return new Response(
              JSON.stringify({ error: "Token OAuth expirado. Reconecte sua conta RD Station.", needs_oauth: true }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          accessToken = refreshResult.access_token!;
        }
      }
    }

    const apiToken = accessToken || privateToken;
    const baseUrl = "https://api.rd.services";

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString();
    const endDate = now.toISOString();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
      "User-Agent": "Habitae-RD-Stats/1.0",
    };

    // Parallel API calls
    const [funnelRes, emailsRes, conversionsRes] = await Promise.allSettled([
      fetch(`${baseUrl}/platform/analytics/funnel?start_date=${startDate}&end_date=${endDate}`, { headers }),
      fetch(`${baseUrl}/platform/analytics/emails?start_date=${startDate}&end_date=${endDate}`, { headers }),
      fetch(`${baseUrl}/platform/contacts?limit=1&order=created_at:desc`, { headers }),
    ]);

    const stats: Record<string, any> = {
      period: { start: startDate, end: endDate },
      auth_method: accessToken ? "oauth" : "private_token",
      funnel: null,
      emails: null,
      contacts: null,
    };

    // Process funnel
    if (funnelRes.status === "fulfilled" && funnelRes.value.ok) {
      stats.funnel = await funnelRes.value.json();
    } else if (funnelRes.status === "fulfilled") {
      const body = await funnelRes.value.text();
      console.log(`[stats] Funnel API returned ${funnelRes.value.status}: ${body.slice(0, 200)}`);
      stats.funnel = { error: `Status ${funnelRes.value.status}`, detail: body.slice(0, 200) };
    }

    // Process emails
    if (emailsRes.status === "fulfilled" && emailsRes.value.ok) {
      stats.emails = await emailsRes.value.json();
    } else if (emailsRes.status === "fulfilled") {
      const body = await emailsRes.value.text();
      console.log(`[stats] Emails API returned ${emailsRes.value.status}: ${body.slice(0, 200)}`);
      stats.emails = { error: `Status ${emailsRes.value.status}`, detail: body.slice(0, 200) };
    }

    // Process contacts
    if (conversionsRes.status === "fulfilled" && conversionsRes.value.ok) {
      stats.contacts = await conversionsRes.value.json();
    } else if (conversionsRes.status === "fulfilled") {
      stats.contacts = { error: `Status ${conversionsRes.value.status}` };
    }

    // Internal CRM stats: leads from RD Station
    const { count: rdLeadsTotal } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("external_source", "rdstation");

    const { count: rdLeadsMonth } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("external_source", "rdstation")
      .gte("created_at", startDate);

    const { count: webhooksTotal } = await supabase
      .from("rd_station_webhook_logs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId);

    const { count: webhooksMonth } = await supabase
      .from("rd_station_webhook_logs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", startDate);

    // Sync logs stats
    const { count: syncTotal } = await supabase
      .from("rd_station_webhook_logs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("event_type", "api_sync");

    const { count: syncCreated } = await supabase
      .from("rd_station_webhook_logs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("event_type", "api_sync")
      .eq("status", "created");

    stats.internal = {
      rd_leads_total: rdLeadsTotal || 0,
      rd_leads_month: rdLeadsMonth || 0,
      webhooks_total: webhooksTotal || 0,
      webhooks_month: webhooksMonth || 0,
      sync_total: syncTotal || 0,
      sync_created: syncCreated || 0,
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

async function refreshOAuthToken(
  supabase: any,
  settings: any,
  orgId: string
): Promise<{ error?: string; access_token?: string }> {
  try {
    const clientId = Deno.env.get("RD_STATION_CLIENT_ID");
    const clientSecret = Deno.env.get("RD_STATION_CLIENT_SECRET");

    if (!clientId || !clientSecret || !settings.oauth_refresh_token) {
      return { error: "Missing OAuth credentials for refresh" };
    }

    const res = await fetch("https://api.rd.services/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: settings.oauth_refresh_token,
      }),
    });

    if (!res.ok) {
      return { error: `Refresh failed: ${res.status}` };
    }

    const data = await res.json();
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token;
    const expiresIn = data.expires_in || 86400;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    await supabase
      .from("rd_station_settings")
      .update({
        oauth_access_token: newAccessToken,
        oauth_refresh_token: newRefreshToken || settings.oauth_refresh_token,
        oauth_token_expires_at: expiresAt,
      })
      .eq("organization_id", orgId);

    return { access_token: newAccessToken };
  } catch (err: any) {
    console.error("OAuth refresh error:", err);
    return { error: err.message };
  }
}
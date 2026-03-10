// v2 - force redeploy
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    // Decode JWT payload without session dependency
    const payloadB64 = token.split(".")[1];
    if (!payloadB64) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const payload = JSON.parse(atob(payloadB64));
    const userId = payload.sub;
    const exp = payload.exp;
    if (!userId || (exp && exp < Math.floor(Date.now() / 1000))) {
      console.error("[meta-sync-entities] Token expired or invalid");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    console.log("[meta-sync-entities] Auth OK, user:", userId);

    const userId = user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "No organization" }), { status: 400, headers: corsHeaders });
    }

    const orgId = profile.organization_id;

    const supa = supabase;

    const { data: account } = await supa
      .from("ad_accounts")
      .select("*")
      .eq("organization_id", orgId)
      .eq("provider", "meta")
      .eq("is_active", true)
      .single();

    if (!account?.auth_payload?.access_token) {
      return new Response(JSON.stringify({ error: "Meta account not connected" }), { status: 400, headers: corsHeaders });
    }

    const accessToken = account.auth_payload.access_token;
    const adAccountId = account.external_account_id;

    let daysBack = 30;
    try {
      const body = await req.json();
      if (body.days_back) daysBack = Math.min(body.days_back, 90);
    } catch {}

    const now = new Date();
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    const sinceStr = since.toISOString().split("T")[0];
    const untilStr = now.toISOString().split("T")[0];

    // 1. Sync campaigns
    const campaignsRes = await fetch(
      `https://graph.facebook.com/v21.0/${adAccountId}/campaigns?fields=id,name,status&limit=100&access_token=${accessToken}`
    );
    const campaignsData = await campaignsRes.json();
    if (campaignsData.error) {
      console.error("Meta API error (campaigns):", campaignsData.error);
      return new Response(JSON.stringify({ error: "Meta API error", details: campaignsData.error.message }), { status: 502, headers: corsHeaders });
    }

    const campaigns = campaignsData.data || [];
    let entitiesSynced = 0;

    for (const c of campaigns) {
      await supa.from("ad_entities").upsert({
        organization_id: orgId,
        provider: "meta",
        entity_type: "campaign",
        external_id: c.id,
        name: c.name,
        status: c.status || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,provider,external_id" });
      entitiesSynced++;
    }

    // 2. Sync adsets
    const adsetsRes = await fetch(
      `https://graph.facebook.com/v21.0/${adAccountId}/adsets?fields=id,name,status,campaign_id&limit=100&access_token=${accessToken}`
    );
    const adsetsData = await adsetsRes.json();
    const adsets = adsetsData.data || [];

    for (const as of adsets) {
      await supa.from("ad_entities").upsert({
        organization_id: orgId,
        provider: "meta",
        entity_type: "adset",
        external_id: as.id,
        name: as.name,
        status: as.status || null,
        parent_external_id: as.campaign_id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,provider,external_id" });
      entitiesSynced++;
    }

    // 3. Sync ads
    const adsRes = await fetch(
      `https://graph.facebook.com/v21.0/${adAccountId}/ads?fields=id,name,status,adset_id,creative{thumbnail_url}&limit=100&access_token=${accessToken}`
    );
    const adsData = await adsRes.json();
    const ads = adsData.data || [];

    for (const ad of ads) {
      await supa.from("ad_entities").upsert({
        organization_id: orgId,
        provider: "meta",
        entity_type: "ad",
        external_id: ad.id,
        name: ad.name,
        status: ad.status || null,
        parent_external_id: ad.adset_id || null,
        thumbnail_url: ad.creative?.thumbnail_url || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,provider,external_id" });
      entitiesSynced++;
    }

    // 4. Sync insights (daily breakdown per ad)
    let insightsSynced = 0;
    const insightsRes = await fetch(
      `https://graph.facebook.com/v21.0/${adAccountId}/insights?fields=ad_id,ad_name,impressions,clicks,spend,actions,ctr,cpc&level=ad&time_range={"since":"${sinceStr}","until":"${untilStr}"}&time_increment=1&limit=500&access_token=${accessToken}`
    );
    const insightsData = await insightsRes.json();

    if (!insightsData.error) {
      const rows = insightsData.data || [];
      for (const row of rows) {
        const leads = (row.actions || []).find((a: any) => a.action_type === "lead")?.value || 0;
        const spend = parseFloat(row.spend || "0");
        const clicks = parseInt(row.clicks || "0");
        const impressions = parseInt(row.impressions || "0");
        const leadsNum = parseInt(leads);

        await supa.from("ad_insights_daily").upsert({
          organization_id: orgId,
          provider: "meta",
          entity_type: "ad",
          external_id: row.ad_id,
          date: row.date_start,
          impressions,
          clicks,
          spend,
          leads: leadsNum,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          cpl: leadsNum > 0 ? spend / leadsNum : 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id,provider,external_id,date" });
        insightsSynced++;
      }
    } else {
      console.error("Meta API error (insights):", insightsData.error);
    }

    return new Response(
      JSON.stringify({ entities: entitiesSynced, insights: insightsSynced, campaigns: campaigns.length, adsets: adsets.length, ads: ads.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});

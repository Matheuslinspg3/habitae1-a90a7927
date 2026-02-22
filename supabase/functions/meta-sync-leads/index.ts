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
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = user.id;

    // Get user's org
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "No organization" }), { status: 400, headers: corsHeaders });
    }

    const orgId = profile.organization_id;

    // Get ad account with service role for auth_payload access
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    // Parse request body for options
    let daysBack = 7;
    try {
      const body = await req.json();
      if (body.days_back) daysBack = Math.min(body.days_back, 90);
    } catch {}

    // Fetch leads from Meta API
    // First get all forms for this ad account
    const formsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/leadgen_forms?fields=id,name&access_token=${accessToken}`;
    const formsRes = await fetch(formsUrl);
    const formsData = await formsRes.json();

    if (formsData.error) {
      console.error("Meta API error (forms):", formsData.error);
      return new Response(JSON.stringify({ error: "Meta API error", details: formsData.error.message }), { status: 502, headers: corsHeaders });
    }

    const forms = formsData.data || [];
    let totalSynced = 0;
    let totalSkipped = 0;

    for (const form of forms) {
      // Fetch leads for each form
      let leadsUrl: string | null = `https://graph.facebook.com/v21.0/${form.id}/leads?fields=id,created_time,field_data,ad_id&limit=100&access_token=${accessToken}`;

      while (leadsUrl) {
        const leadsRes = await fetch(leadsUrl);
        const leadsData = await leadsRes.json();

        if (leadsData.error) {
          console.error(`Meta API error (leads for form ${form.id}):`, leadsData.error);
          break;
        }

        const leads = leadsData.data || [];

        for (const lead of leads) {
          // Check date filter
          const createdTime = new Date(lead.created_time);
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - daysBack);
          if (createdTime < cutoff) continue;

          // Extract fields
          const fieldData = lead.field_data || [];
          const getField = (name: string) => {
            const f = fieldData.find((fd: any) => fd.name === name);
            return f?.values?.[0] || null;
          };

          const name = getField("full_name") || getField("nome") || getField("name");
          const email = getField("email");
          const phone = getField("phone_number") || getField("telefone") || getField("phone");

          // Upsert lead
          const { error: upsertError } = await supa
            .from("ad_leads")
            .upsert({
              organization_id: orgId,
              provider: "meta",
              external_lead_id: lead.id,
              external_ad_id: lead.ad_id || "unknown",
              external_form_id: form.id,
              name,
              email,
              phone,
              created_time: lead.created_time,
              raw_payload: lead,
              updated_at: new Date().toISOString(),
            }, { onConflict: "organization_id,external_lead_id" });

          if (upsertError) {
            console.error("Lead upsert error:", upsertError);
            totalSkipped++;
          } else {
            totalSynced++;
          }
        }

        // Pagination
        leadsUrl = leadsData.paging?.next || null;
      }
    }

    // Check auto-send setting
    const { data: adSettings } = await supa
      .from("ad_settings")
      .select("auto_send_to_crm, crm_stage_id")
      .eq("organization_id", orgId)
      .single();

    let autoSent = 0;
    if (adSettings?.auto_send_to_crm && adSettings?.crm_stage_id) {
      // Get new leads that haven't been sent to CRM
      const { data: newLeads } = await supa
        .from("ad_leads")
        .select("id, name, email, phone, external_ad_id")
        .eq("organization_id", orgId)
        .eq("status", "new");

      for (const nl of (newLeads || [])) {
        const { data: crmLead, error: crmError } = await supa
          .from("leads")
          .insert({
            name: nl.name || "Lead de Anúncio",
            email: nl.email,
            phone: nl.phone,
            organization_id: orgId,
            created_by: userId,
            lead_stage_id: adSettings.crm_stage_id,
            stage: "novo",
            source: "anuncio",
            notes: `Lead importado automaticamente de Meta Ads (Ad ID: ${nl.external_ad_id})`,
          })
          .select("id")
          .single();

        if (!crmError && crmLead) {
          await supa.from("ad_leads").update({
            status: "sent_to_crm",
            crm_record_id: crmLead.id,
            updated_at: new Date().toISOString(),
          }).eq("id", nl.id);
          autoSent++;
        }
      }
    }

    return new Response(
      JSON.stringify({ synced: totalSynced, skipped: totalSkipped, auto_sent: autoSent, forms: forms.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});

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

    // Parse request body for options
    let daysBack = 7;
    try {
      const body = await req.json();
      if (body.days_back) daysBack = Math.min(body.days_back, 90);
    } catch {}

    // Step 1: Get Pages the user manages (leadgen_forms belong to Pages, not Ad Accounts)
    const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&limit=100&access_token=${accessToken}`;
    const pagesRes = await fetch(pagesUrl);
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      console.error("Meta API error (pages):", pagesData.error);
      return new Response(JSON.stringify({ error: "Meta API error", details: pagesData.error.message }), { status: 502, headers: corsHeaders });
    }

    const pages = pagesData.data || [];
    if (pages.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, skipped: 0, auto_sent: 0, forms: 0, message: "Nenhuma página encontrada. Verifique se o token possui permissão pages_read_engagement." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSynced = 0;
    let totalSkipped = 0;
    let totalForms = 0;

    for (const page of pages) {
      // Use page-specific access token for better permissions
      const pageToken = page.access_token || accessToken;

      // Step 2: Get leadgen forms for each page
      const formsUrl = `https://graph.facebook.com/v21.0/${page.id}/leadgen_forms?fields=id,name&access_token=${pageToken}`;
      const formsRes = await fetch(formsUrl);
      const formsData = await formsRes.json();

      if (formsData.error) {
        console.error(`Meta API error (forms for page ${page.id}):`, formsData.error);
        continue; // Skip this page, try next
      }

      const forms = formsData.data || [];
      totalForms += forms.length;

      for (const form of forms) {
        // Step 3: Fetch leads for each form
        let leadsUrl: string | null = `https://graph.facebook.com/v21.0/${form.id}/leads?fields=id,created_time,field_data,ad_id&limit=100&access_token=${pageToken}`;

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
      JSON.stringify({ synced: totalSynced, skipped: totalSkipped, auto_sent: autoSent, forms: totalForms, pages: pages.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});

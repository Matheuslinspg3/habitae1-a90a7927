import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("token");
    const orgParam = url.searchParams.get("org");

    if (!secret) {
      return new Response(
        JSON.stringify({ error: "Missing token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build query — validate token; optionally match org prefix for extra safety
    let query = supabase
      .from("rd_station_settings")
      .select("*")
      .eq("webhook_secret", secret)
      .eq("is_active", true);

    const { data: allMatches, error: settingsError } = await query;

    if (settingsError || !allMatches || allMatches.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive webhook" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If org param provided, match by prefix for extra identification
    let settings = allMatches[0];
    if (orgParam && allMatches.length > 0) {
      const match = allMatches.find((s: any) => s.organization_id.startsWith(orgParam));
      if (match) settings = match;
    }

    const orgId = settings.organization_id;

    const payload = await req.json();

    // RD Station Marketing webhook payload structure
    // https://developers.rdstation.com/reference/webhooks
    const leads = payload.leads || [payload];

    const results: any[] = [];

    for (const leadData of leads) {
      let leadId: string | null = null;
      let status = "processed";
      let errorMessage: string | null = null;

      try {
        // Extract lead fields from RD Station format
        const name =
          leadData.name ||
          leadData.nome ||
          `${leadData.first_name || ""} ${leadData.last_name || ""}`.trim() ||
          "Lead RD Station";
        const email = leadData.email || leadData.personal_email || null;
        const phone =
          leadData.personal_phone ||
          leadData.mobile_phone ||
          leadData.phone ||
          leadData.telefone ||
          null;
        const source = "RD Station (Webhook)";

        // Check for duplicate by email
        if (email) {
          const { data: existing } = await supabase
            .from("leads")
            .select("id")
            .eq("organization_id", orgId)
            .eq("email", email)
            .limit(1)
            .single();

          if (existing) {
            leadId = existing.id;
            status = "duplicate";
            results.push({ name, email, status: "duplicate", leadId });
            continue;
          }
        }

        if (settings.auto_send_to_crm) {
          // Get admin user for created_by
          const { data: adminProfile } = await supabase
            .from("profiles")
            .select("user_id")
            .eq("organization_id", orgId)
            .limit(1)
            .single();

          if (!adminProfile) {
            throw new Error("No user found in organization");
          }

          const { data: newLead, error: insertError } = await supabase
            .from("leads")
            .insert({
              organization_id: orgId,
              name,
              email,
              phone,
              source,
              lead_stage_id: settings.default_stage_id,
              created_by: adminProfile.user_id,
              external_id: leadData.id?.toString() || null,
              external_source: "rdstation",
              notes: buildNotes(leadData),
            })
            .select("id")
            .single();

          if (insertError) throw insertError;
          leadId = newLead?.id || null;
          status = "created";

          // Notify org managers about new RD Station lead
          if (newLead?.id) {
            const { data: managers } = await supabase
              .from("user_roles")
              .select("user_id")
              .in("role", ["admin", "sub_admin"]);

            const orgManagers = managers || [];
            for (const mgr of orgManagers) {
              // Verify manager belongs to this org
              const { data: mgrProfile } = await supabase
                .from("profiles")
                .select("user_id")
                .eq("user_id", mgr.user_id)
                .eq("organization_id", orgId)
                .maybeSingle();

              if (mgrProfile) {
                await supabase.rpc("insert_notification", {
                  p_user_id: mgrProfile.user_id,
                  p_organization_id: orgId,
                  p_type: "rd_lead_received",
                  p_title: "Novo lead do RD Station",
                  p_message: `O lead "${name}" chegou via webhook do RD Station.`,
                  p_entity_id: newLead.id,
                  p_entity_type: "lead",
                });
              }
            }
          }
        } else {
          status = "received_not_sent";
        }

function buildNotes(data: Record<string, any>): string {
  const ignore = new Set([
    "id", "name", "nome", "email", "phone", "telefone",
    "personal_phone", "mobile_phone", "personal_email",
    "first_name", "last_name", "traffic_source",
    "conversion_identifier",
  ]);
  const lines: string[] = [];

  // Extract conversion events
  if (data.first_conversion) {
    const fc = data.first_conversion;
    lines.push(`Primeira conversão: ${fc.content?.identifier || fc.conversion_identifier || JSON.stringify(fc.content || fc)}`);
    if (fc.source) lines.push(`  Origem: ${fc.source}`);
    if (fc.created_at) lines.push(`  Data: ${fc.created_at}`);
  }
  if (data.last_conversion && data.last_conversion !== data.first_conversion) {
    const lc = data.last_conversion;
    lines.push(`Última conversão: ${lc.content?.identifier || lc.conversion_identifier || JSON.stringify(lc.content || lc)}`);
    if (lc.source) lines.push(`  Origem: ${lc.source}`);
    if (lc.created_at) lines.push(`  Data: ${lc.created_at}`);
  }

  // Extract custom fields
  if (data.custom_fields && typeof data.custom_fields === "object") {
    const cf = data.custom_fields;
    for (const [key, value] of Object.entries(cf)) {
      if (value != null && value !== "") {
        lines.push(`${key}: ${value}`);
      }
    }
  }

  // Extract other useful fields
  if (data.lead_stage) lines.push(`Estágio no funil: ${data.lead_stage}`);
  if (data.number_conversions) lines.push(`Nº conversões: ${data.number_conversions}`);
  if (data.public_url) lines.push(`URL RD Station: ${data.public_url}`);
  if (data.uuid) lines.push(`UUID: ${data.uuid}`);
  if (data.opportunity === true) lines.push(`Oportunidade: Sim`);
  if (data.company) lines.push(`Empresa: ${data.company}`);
  if (data.job_title) lines.push(`Cargo: ${data.job_title}`);
  if (data.city) lines.push(`Cidade: ${data.city}`);
  if (data.state) lines.push(`Estado: ${data.state}`);
  if (data.tags && Array.isArray(data.tags)) lines.push(`Tags: ${data.tags.join(", ")}`);

  // Remaining simple fields
  for (const [key, value] of Object.entries(data)) {
    if (ignore.has(key) || value == null || value === "" || typeof value === "object" ||
        ["first_conversion", "last_conversion", "custom_fields", "lead_stage",
         "number_conversions", "public_url", "uuid", "opportunity", "company",
         "job_title", "city", "state", "tags", "created_at"].includes(key)) continue;
    lines.push(`${key}: ${value}`);
  }

  return lines.length > 0
    ? `[RD Station]\n${lines.join("\n")}`
    : "[Importado via RD Station]";
}

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("RD Station webhook error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildNotes(data: Record<string, any>): string {
  const ignore = new Set([
    "id", "name", "nome", "email", "phone", "telefone",
    "personal_phone", "mobile_phone", "personal_email",
    "first_name", "last_name", "traffic_source",
    "conversion_identifier",
  ]);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (!ignore.has(key) && value != null && value !== "") {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.length > 0
    ? `[RD Station]\n${lines.join("\n")}`
    : "[Importado via RD Station]";
}

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
        const source = leadData.traffic_source || leadData.conversion_identifier || settings.default_source;

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
        } else {
          status = "received_not_sent";
        }

        results.push({ name, email, status, leadId });
      } catch (err: any) {
        errorMessage = err.message || "Unknown error";
        status = "error";
        results.push({ status: "error", error: errorMessage });
      }

      // Log webhook
      await supabase.from("rd_station_webhook_logs").insert({
        organization_id: orgId,
        event_type: payload.event_type || "conversion",
        payload: leadData,
        lead_id: leadId,
        status,
        error_message: errorMessage,
      });
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

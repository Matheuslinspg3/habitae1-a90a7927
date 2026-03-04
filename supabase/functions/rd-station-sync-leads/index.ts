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
      .select("organization_id, user_id")
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

    if (!settings?.api_private_key) {
      return new Response(
        JSON.stringify({ error: "Chave privada de API não configurada. Configure nas configurações do RD Station." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.is_active) {
      return new Response(
        JSON.stringify({ error: "Integração RD Station está inativa." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiToken = settings.api_private_key;
    const baseUrl = "https://api.rd.services";
    const headers = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };

    let created = 0;
    let duplicates = 0;
    let errors = 0;
    let page = 1;
    const pageSize = 125;
    const maxPages = 10; // Safety limit: max ~1250 contacts
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const contactsRes = await fetch(
        `${baseUrl}/platform/contacts?page=${page}&order=created_at:desc&limit=${pageSize}`,
        { headers }
      );

      if (!contactsRes.ok) {
        const errBody = await contactsRes.text();
        console.error("RD Station API error:", contactsRes.status, errBody);
        return new Response(
          JSON.stringify({
            error: `Erro na API do RD Station (${contactsRes.status}). Verifique se a chave de API está correta.`,
            details: errBody,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await contactsRes.json();
      const contacts = data.contacts || [];

      if (contacts.length === 0) {
        hasMore = false;
        break;
      }

      for (const contact of contacts) {
        try {
          const email = contact.email || null;
          const name =
            contact.name ||
            `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
            "Lead RD Station";
          const phone =
            contact.personal_phone ||
            contact.mobile_phone ||
            null;

          // Deduplicate by email
          if (email) {
            const { data: existing } = await supabase
              .from("leads")
              .select("id")
              .eq("organization_id", orgId)
              .eq("email", email)
              .limit(1)
              .maybeSingle();

            if (existing) {
              duplicates++;
              // Log as duplicate
              await supabase.from("rd_station_webhook_logs").insert({
                organization_id: orgId,
                event_type: "api_sync",
                payload: { name, email, phone, rd_uuid: contact.uuid },
                status: "duplicate",
              });
              continue;
            }
          }

          if (settings.auto_send_to_crm) {
            const source = settings.default_source || "RD Station";

            const notes = buildNotes(contact);

            const { data: newLead, error: insertError } = await supabase
              .from("leads")
              .insert({
                organization_id: orgId,
                name,
                email,
                phone,
                source,
                lead_stage_id: settings.default_stage_id,
                created_by: profile.user_id,
                external_id: contact.uuid || null,
                external_source: "rdstation",
                notes,
              })
              .select("id")
              .single();

            if (insertError) {
              console.error("Insert lead error:", insertError);
              errors++;
              await supabase.from("rd_station_webhook_logs").insert({
                organization_id: orgId,
                event_type: "api_sync",
                payload: { name, email, phone },
                status: "error",
                error_message: insertError.message,
              });
              continue;
            }

            created++;
            await supabase.from("rd_station_webhook_logs").insert({
              organization_id: orgId,
              event_type: "api_sync",
              payload: { name, email, phone, rd_uuid: contact.uuid },
              lead_id: newLead?.id,
              status: "created",
            });
          } else {
            // Log as received but not sent to CRM
            await supabase.from("rd_station_webhook_logs").insert({
              organization_id: orgId,
              event_type: "api_sync",
              payload: { name, email, phone, rd_uuid: contact.uuid },
              status: "received_not_sent",
            });
            created++; // Count as processed
          }
        } catch (contactErr: any) {
          console.error("Contact processing error:", contactErr);
          errors++;
        }
      }

      // Check if there are more pages
      if (contacts.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        created,
        duplicates,
        errors,
        pages_processed: page,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("RD Station sync error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildNotes(data: Record<string, any>): string {
  const ignore = new Set([
    "uuid", "name", "email", "personal_phone", "mobile_phone",
    "first_name", "last_name",
  ]);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (!ignore.has(key) && value != null && value !== "" && typeof value !== "object") {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.length > 0
    ? `[Sincronizado via RD Station API]\n${lines.join("\n")}`
    : "[Sincronizado via RD Station API]";
}

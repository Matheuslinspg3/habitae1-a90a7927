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

    if (!settings) {
      return new Response(
        JSON.stringify({ error: "Configurações do RD Station não encontradas." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.is_active) {
      return new Response(
        JSON.stringify({ error: "Integração RD Station está inativa." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get OAuth access token (required for listing contacts)
    let accessToken = settings.oauth_access_token;

    if (!accessToken) {
      return new Response(
        JSON.stringify({
          error: "Conexão OAuth não configurada. Conecte sua conta RD Station via OAuth para sincronizar leads.",
          needs_oauth: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is expired and try to refresh
    if (settings.oauth_token_expires_at) {
      const expiresAt = new Date(settings.oauth_token_expires_at);
      if (expiresAt < new Date()) {
        console.log("OAuth token expired, attempting refresh...");
        const refreshResult = await refreshToken(supabase, settings, orgId);
        if (refreshResult.error) {
          return new Response(
            JSON.stringify({
              error: "Token OAuth expirado. Reconecte sua conta RD Station.",
              needs_oauth: true,
            }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        accessToken = refreshResult.access_token;
      }
    }

    const baseUrl = "https://api.rd.services";
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    let created = 0;
    let duplicates = 0;
    let errors = 0;
    let page = 1;
    const pageSize = 125;
    const maxPages = 10;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const contactsRes = await fetch(
        `${baseUrl}/platform/contacts?page=${page}&order=created_at:desc&limit=${pageSize}`,
        { headers }
      );

      if (contactsRes.status === 401) {
        // Token may have been invalidated; try refresh once
        const errBody = await contactsRes.text();
        console.error("RD Station 401, attempting token refresh:", errBody);

        const refreshResult = await refreshToken(supabase, settings, orgId);
        if (refreshResult.error) {
          return new Response(
            JSON.stringify({
              error: "Token OAuth inválido ou expirado. Reconecte sua conta RD Station.",
              needs_oauth: true,
            }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Retry with new token
        accessToken = refreshResult.access_token;
        headers.Authorization = `Bearer ${accessToken}`;
        const retryRes = await fetch(
          `${baseUrl}/platform/contacts?page=${page}&order=created_at:desc&limit=${pageSize}`,
          { headers }
        );
        if (!retryRes.ok) {
          const retryBody = await retryRes.text();
          console.error("RD Station retry failed:", retryRes.status, retryBody);
          return new Response(
            JSON.stringify({
              error: `Erro na API do RD Station (${retryRes.status}).`,
              needs_oauth: true,
            }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const retryData = await retryRes.json();
        const retryContacts = retryData.contacts || [];
        if (retryContacts.length === 0) { hasMore = false; break; }
        // Process retryContacts below (same logic)
        await processContacts(supabase, retryContacts, orgId, settings, profile.user_id, { created, duplicates, errors }).then(r => {
          created = r.created; duplicates = r.duplicates; errors = r.errors;
        });
        if (retryContacts.length < pageSize) { hasMore = false; } else { page++; }
        continue;
      }

      if (!contactsRes.ok) {
        const errBody = await contactsRes.text();
        console.error("RD Station API error:", contactsRes.status, errBody);
        return new Response(
          JSON.stringify({
            error: `Erro na API do RD Station (${contactsRes.status}). A API pode estar temporariamente indisponível. Tente novamente em alguns minutos.`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await contactsRes.json();
      const contacts = data.contacts || [];

      if (contacts.length === 0) {
        hasMore = false;
        break;
      }

      const result = await processContacts(supabase, contacts, orgId, settings, profile.user_id, { created, duplicates, errors });
      created = result.created;
      duplicates = result.duplicates;
      errors = result.errors;

      if (contacts.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, created, duplicates, errors, pages_processed: page }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("RD Station sync error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function refreshToken(
  supabase: any,
  settings: any,
  orgId: string
): Promise<{ access_token?: string; error?: string }> {
  const clientId = Deno.env.get("RD_STATION_CLIENT_ID");
  const clientSecret = Deno.env.get("RD_STATION_CLIENT_SECRET");

  if (!clientId || !clientSecret || !settings.oauth_refresh_token) {
    return { error: "Missing credentials for token refresh" };
  }

  try {
    const res = await fetch("https://api.rd.services/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: settings.oauth_refresh_token,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.access_token) {
      console.error("Token refresh failed:", JSON.stringify(data));
      return { error: "Refresh failed" };
    }

    const expiresAt = new Date(Date.now() + (data.expires_in || 86400) * 1000).toISOString();

    await supabase
      .from("rd_station_settings")
      .update({
        oauth_access_token: data.access_token,
        oauth_refresh_token: data.refresh_token || settings.oauth_refresh_token,
        oauth_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId);

    console.log("OAuth token refreshed successfully");
    return { access_token: data.access_token };
  } catch (err) {
    console.error("Token refresh error:", err);
    return { error: "Refresh error" };
  }
}

async function processContacts(
  supabase: any,
  contacts: any[],
  orgId: string,
  settings: any,
  userId: string,
  counters: { created: number; duplicates: number; errors: number }
) {
  let { created, duplicates, errors } = counters;

  for (const contact of contacts) {
    try {
      const email = contact.email || null;
      const name =
        contact.name ||
        `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
        "Lead RD Station";
      const phone = contact.personal_phone || contact.mobile_phone || null;

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
            created_by: userId,
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
        await supabase.from("rd_station_webhook_logs").insert({
          organization_id: orgId,
          event_type: "api_sync",
          payload: { name, email, phone, rd_uuid: contact.uuid },
          status: "received_not_sent",
        });
        created++;
      }
    } catch (contactErr: any) {
      console.error("Contact processing error:", contactErr);
      errors++;
    }
  }

  return { created, duplicates, errors };
}

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

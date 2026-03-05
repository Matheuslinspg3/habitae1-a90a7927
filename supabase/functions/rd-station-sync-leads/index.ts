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

    // Get OAuth access token (required for Platform/Marketing API)
    let accessToken = settings.oauth_access_token;

    if (!accessToken) {
      return new Response(
        JSON.stringify({
          error: "Conexão OAuth não configurada. Conecte sua conta RD Station via OAuth.",
          needs_oauth: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is expired and try to refresh
    if (settings.oauth_token_expires_at) {
      const expiresAt = new Date(settings.oauth_token_expires_at);
      if (expiresAt < new Date()) {
        const refreshResult = await refreshToken(supabase, settings, orgId);
        if (refreshResult.error) {
          return new Response(
            JSON.stringify({ error: "Token OAuth expirado. Reconecte sua conta RD Station.", needs_oauth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        accessToken = refreshResult.access_token!;
      }
    }

    const apiHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "Habitae-RD-Sync/1.0",
    };

    // Step 1: Find the "all contacts" segmentation
    const segRes = await fetchWithTimeout(
      "https://api.rd.services/platform/segmentations",
      apiHeaders,
      15000
    );

    if (!segRes.ok) {
      if (segRes.status === 401) {
        const refreshResult = await refreshToken(supabase, settings, orgId);
        if (refreshResult.error) {
          return new Response(
            JSON.stringify({ error: "Token OAuth inválido. Reconecte sua conta RD Station.", needs_oauth: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        accessToken = refreshResult.access_token!;
        apiHeaders.Authorization = `Bearer ${accessToken}`;
      } else {
        return new Response(
          JSON.stringify({ error: `Erro ao listar segmentações do RD Station (${segRes.status}).` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const segData = segRes.ok ? await segRes.json() : null;
    let segmentations = segData?.segmentations || [];

    // If segmentations fetch failed after refresh, retry
    if (!segRes.ok) {
      const retryRes = await fetchWithTimeout(
        "https://api.rd.services/platform/segmentations",
        apiHeaders,
        15000
      );
      if (!retryRes.ok) {
        return new Response(
          JSON.stringify({ error: `Erro ao listar segmentações do RD Station (${retryRes.status}).` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const retryData = await retryRes.json();
      segmentations = retryData?.segmentations || [];
    }

    // Find "Leads" segmentation (prefer custom segmentation_id from settings, fallback to defaults)
    const targetSegId = settings.rd_segmentation_id || null;
    let segmentation = targetSegId
      ? segmentations.find((s: any) => String(s.id) === String(targetSegId))
      : null;

    if (!segmentation) {
      // Fallback: use "Leads" or "Todos os contatos" segmentation
      segmentation =
        segmentations.find((s: any) => s.name === "Leads (estágio no funil)") ||
        segmentations.find((s: any) => s.name?.includes("Todos os contatos")) ||
        segmentations[0];
    }

    if (!segmentation) {
      return new Response(
        JSON.stringify({ error: "Nenhuma segmentação encontrada no RD Station." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Using segmentation: "${segmentation.name}" (ID: ${segmentation.id})`);

    // Step 2: Paginate contacts from the segmentation
    let created = 0;
    let duplicates = 0;
    let errors = 0;
    let page = 1;
    const pageSize = 125;
    const maxPages = 10;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const contactsUrl = `https://api.rd.services/platform/segmentations/${segmentation.id}/contacts?page=${page}&page_size=${pageSize}`;
      const contactsRes = await fetchWithTimeout(contactsUrl, apiHeaders, 15000);

      if (contactsRes.status === 401) {
        const refreshResult = await refreshToken(supabase, settings, orgId);
        if (refreshResult.error) {
          return new Response(
            JSON.stringify({ error: "Token OAuth expirado durante sincronização. Reconecte.", needs_oauth: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        accessToken = refreshResult.access_token!;
        apiHeaders.Authorization = `Bearer ${accessToken}`;
        continue; // retry same page
      }

      if (contactsRes.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Limite de requisições do RD Station atingido. Aguarde e tente novamente.",
            partial: { created, duplicates, errors, pages_processed: page },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!contactsRes.ok) {
        const errText = await contactsRes.text();
        return new Response(
          JSON.stringify({
            error: `Erro na API do RD Station (${contactsRes.status}) ao listar contatos.`,
            summary: summarizeRdError(errText),
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await contactsRes.json();
      const contacts = Array.isArray(data?.contacts) ? data.contacts : (Array.isArray(data) ? data : []);

      if (contacts.length === 0) {
        hasMore = false;
        break;
      }

      const result = await processContacts(supabase, contacts, orgId, settings, profile.user_id, {
        created,
        duplicates,
        errors,
      });
      created = result.created;
      duplicates = result.duplicates;
      errors = result.errors;

      if (typeof data?.has_more === "boolean") {
        hasMore = data.has_more;
        if (hasMore) page++;
      } else if (contacts.length < pageSize) {
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
        segmentation_name: segmentation.name,
      }),
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

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === "AbortError") {
      return new Response("Timeout", { status: 504 });
    }
    throw err;
  }
}

function summarizeRdError(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, 220);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
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

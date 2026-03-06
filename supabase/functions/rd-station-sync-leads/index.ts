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
    let body: Record<string, any> = {};
    try { body = await req.json(); } catch { /* empty body is ok */ }

    const isAutoSync = body?.auto_sync === true;
    const isSelective = body?.selective === true;

    if (isAutoSync) {
      return await handleAutoSync(supabase);
    } else if (isSelective) {
      return await handleSelectiveSync(req, supabase, body);
    } else {
      return await handleManualSync(req, supabase);
    }
  } catch (err: any) {
    console.error("RD Station sync error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── AUTO SYNC: called by pg_cron, iterates all orgs with active OAuth ───

async function handleAutoSync(supabase: any): Promise<Response> {
  console.log("[auto_sync] Starting auto sync for all orgs...");

  const { data: allSettings, error: settingsErr } = await supabase
    .from("rd_station_settings")
    .select("*, organization_id")
    .eq("is_active", true)
    .not("oauth_access_token", "is", null);

  if (settingsErr || !allSettings?.length) {
    console.log("[auto_sync] No active orgs with OAuth:", settingsErr?.message || "0 orgs");
    return new Response(
      JSON.stringify({ success: true, message: "No orgs to sync", orgs_processed: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results: any[] = [];

  for (const settings of allSettings) {
    const orgId = settings.organization_id;
    try {
      // Get the org admin user_id for created_by
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("organization_id", orgId)
        .limit(1)
        .single();

      if (!adminProfile) {
        results.push({ org: orgId, error: "No profile found" });
        continue;
      }

      const syncResult = await syncOrgContacts(supabase, settings, orgId, adminProfile.user_id);
      results.push({ org: orgId, ...syncResult });

      // Update last_sync_at
      await supabase
        .from("rd_station_settings")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("organization_id", orgId);

      // Small delay between orgs to avoid rate limiting
      await sleep(1000);
    } catch (orgErr: any) {
      console.error(`[auto_sync] Error for org ${orgId}:`, orgErr);
      results.push({ org: orgId, error: orgErr.message });
    }
  }

  console.log(`[auto_sync] Completed. Processed ${results.length} orgs.`);

  return new Response(
    JSON.stringify({ success: true, orgs_processed: results.length, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ─── MANUAL SYNC: called by user from the UI ───

async function handleManualSync(req: Request, supabase: any): Promise<Response> {
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

  if (!settings.oauth_access_token) {
    return new Response(
      JSON.stringify({ error: "Conexão OAuth não configurada.", needs_oauth: true }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const syncResult = await syncOrgContacts(supabase, settings, orgId, profile.user_id);

  if (syncResult.error) {
    return new Response(JSON.stringify(syncResult), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Update last_sync_at
  await supabase
    .from("rd_station_settings")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("organization_id", orgId);

  return new Response(JSON.stringify({ success: true, ...syncResult }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── SELECTIVE SYNC: import specific contacts chosen by user ───

async function handleSelectiveSync(req: Request, supabase: any, body: Record<string, any>): Promise<Response> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, user_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.organization_id) {
    return new Response(JSON.stringify({ error: "No organization" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orgId = profile.organization_id;
  const contactUuids: string[] = body.contact_uuids || [];
  const mergeExisting = body.merge_existing === true;

  if (contactUuids.length === 0) {
    return new Response(JSON.stringify({ error: "Nenhum contato selecionado." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: settings } = await supabase
    .from("rd_station_settings")
    .select("*")
    .eq("organization_id", orgId)
    .single();

  if (!settings?.oauth_access_token) {
    return new Response(
      JSON.stringify({ error: "OAuth não configurado.", needs_oauth: true }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let accessToken = settings.oauth_access_token;
  if (settings.oauth_token_expires_at && new Date(settings.oauth_token_expires_at) < new Date()) {
    const refreshResult = await refreshToken(supabase, settings, orgId);
    if (refreshResult.error) {
      return new Response(JSON.stringify({ error: "Token expirado.", needs_oauth: true }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    accessToken = refreshResult.access_token!;
  }

  const apiHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };

  // Fetch segmentations to get contacts
  const segRes = await fetchWithTimeout("https://api.rd.services/platform/segmentations", apiHeaders, 15000);
  if (!segRes.ok) {
    return new Response(JSON.stringify({ error: `Erro segmentações (${segRes.status})` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const segData = await segRes.json();
  const segmentations = segData?.segmentations || [];
  const targetSegId = settings.rd_segmentation_id || null;
  let segmentation = targetSegId
    ? segmentations.find((s: any) => String(s.id) === String(targetSegId))
    : null;
  if (!segmentation) {
    segmentation =
      segmentations.find((s: any) => s.name === "Leads (estágio no funil)") ||
      segmentations.find((s: any) => s.name?.includes("Todos os contatos")) ||
      segmentations[0];
  }
  if (!segmentation) {
    return new Response(JSON.stringify({ error: "Nenhuma segmentação encontrada." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch all contacts to find selected ones
  const uuidSet = new Set(contactUuids);
  const selectedContacts: any[] = [];
  let page = 1;
  const pageSize = 125;
  let hasMore = true;

  while (hasMore && page <= 10) {
    const url = `https://api.rd.services/platform/segmentations/${segmentation.id}/contacts?page=${page}&page_size=${pageSize}`;
    const res = await fetchWithTimeout(url, apiHeaders, 15000);
    if (!res.ok) break;
    const data = await res.json();
    const contacts = Array.isArray(data?.contacts) ? data.contacts : (Array.isArray(data) ? data : []);
    if (contacts.length === 0) break;

    for (const c of contacts) {
      if (c.uuid && uuidSet.has(c.uuid)) {
        selectedContacts.push(c);
        uuidSet.delete(c.uuid);
      }
    }

    if (uuidSet.size === 0) break;
    hasMore = typeof data?.has_more === "boolean" ? data.has_more : contacts.length >= pageSize;
    page++;
  }

  // Process selected contacts
  let created = 0;
  let updated = 0;
  let duplicates = 0;
  let errors = 0;

  for (const contact of selectedContacts) {
    try {
      const email = contact.email || null;
      const name = contact.name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Lead RD Station";
      const phone = contact.personal_phone || contact.mobile_phone || null;
      const notes = buildNotes(contact);

      let existingLead: any = null;

      if (contact.uuid) {
        const { data: byExtId } = await supabase
          .from("leads").select("id").eq("organization_id", orgId)
          .eq("external_id", contact.uuid).maybeSingle();
        if (byExtId) existingLead = byExtId;
      }

      if (!existingLead && email) {
        const { data: byEmail } = await supabase
          .from("leads").select("id").eq("organization_id", orgId)
          .eq("email", email).maybeSingle();
        if (byEmail) existingLead = byEmail;
      }

      if (!existingLead && phone) {
        const normalizedPhone = phone.replace(/\D/g, "");
        if (normalizedPhone.length >= 8) {
          const { data: allLeads } = await supabase
            .from("leads").select("id, phone").eq("organization_id", orgId)
            .not("phone", "is", null);
          const match = (allLeads || []).find((l: any) => {
            const lPhone = (l.phone || "").replace(/\D/g, "");
            return lPhone.length >= 8 && (lPhone === normalizedPhone || lPhone.endsWith(normalizedPhone) || normalizedPhone.endsWith(lPhone));
          });
          if (match) existingLead = match;
        }
      }

      if (existingLead && mergeExisting) {
        const updateData: Record<string, any> = {};
        if (email) updateData.email = email;
        if (phone) updateData.phone = phone;
        if (notes) updateData.notes = notes;
        updateData.external_id = contact.uuid || undefined;
        updateData.external_source = "rdstation";
        await supabase.from("leads").update(updateData).eq("id", existingLead.id);
        updated++;
      } else if (existingLead) {
        duplicates++;
      } else {
        const source = settings.default_source || "RD Station";
        const { error: insertError } = await supabase.from("leads").insert({
          organization_id: orgId, name, email, phone, source,
          lead_stage_id: settings.default_stage_id,
          created_by: profile.user_id,
          external_id: contact.uuid || null,
          external_source: "rdstation",
          notes,
        });
        if (insertError) errors++;
        else created++;
      }
    } catch { errors++; }
  }

  await supabase.from("rd_station_settings")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("organization_id", orgId);

  return new Response(
    JSON.stringify({ success: true, created, updated, duplicates, errors }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ─── CORE SYNC LOGIC (shared between manual and auto) ───

async function syncOrgContacts(
  supabase: any,
  settings: any,
  orgId: string,
  userId: string,
  options?: { skipDuplicateLog?: boolean }
): Promise<Record<string, any>> {
  let accessToken = settings.oauth_access_token;

  // Check if token is expired and try to refresh
  if (settings.oauth_token_expires_at) {
    const expiresAt = new Date(settings.oauth_token_expires_at);
    if (expiresAt < new Date()) {
      const refreshResult = await refreshToken(supabase, settings, orgId);
      if (refreshResult.error) {
        return { error: "Token OAuth expirado.", needs_oauth: true };
      }
      accessToken = refreshResult.access_token!;
    }
  }

  const apiHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "User-Agent": "Habitae-RD-Sync/1.0",
  };

  // Step 1: Get segmentations
  let segRes = await fetchWithTimeout(
    "https://api.rd.services/platform/segmentations",
    apiHeaders,
    15000
  );

  // Handle 401 with token refresh
  if (segRes.status === 401) {
    const refreshResult = await refreshToken(supabase, settings, orgId);
    if (refreshResult.error) {
      return { error: "Token OAuth inválido.", needs_oauth: true };
    }
    accessToken = refreshResult.access_token!;
    apiHeaders.Authorization = `Bearer ${accessToken}`;
    segRes = await fetchWithTimeout(
      "https://api.rd.services/platform/segmentations",
      apiHeaders,
      15000
    );
  }

  if (!segRes.ok) {
    return { error: `Erro ao listar segmentações (${segRes.status}).` };
  }

  const segData = await segRes.json();
  const segmentations = segData?.segmentations || [];

  // Find target segmentation
  const targetSegId = settings.rd_segmentation_id || null;
  let segmentation = targetSegId
    ? segmentations.find((s: any) => String(s.id) === String(targetSegId))
    : null;

  if (!segmentation) {
    segmentation =
      segmentations.find((s: any) => s.name === "Leads (estágio no funil)") ||
      segmentations.find((s: any) => s.name?.includes("Todos os contatos")) ||
      segmentations[0];
  }

  if (!segmentation) {
    return { error: "Nenhuma segmentação encontrada no RD Station." };
  }

  console.log(`[sync] Org ${orgId}: Using segmentation "${segmentation.name}" (ID: ${segmentation.id})`);

  // Step 2: Paginate contacts
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
        return { error: "Token expirado durante sync.", needs_oauth: true, partial: { created, duplicates, errors } };
      }
      accessToken = refreshResult.access_token!;
      apiHeaders.Authorization = `Bearer ${accessToken}`;
      continue;
    }

    if (contactsRes.status === 429) {
      return {
        error: "Limite de requisições atingido.",
        partial: { created, duplicates, errors, pages_processed: page },
      };
    }

    if (!contactsRes.ok) {
      const errText = await contactsRes.text();
      return {
        error: `Erro na API (${contactsRes.status}).`,
        summary: summarizeRdError(errText),
      };
    }

    const data = await contactsRes.json();
    const contacts = Array.isArray(data?.contacts) ? data.contacts : (Array.isArray(data) ? data : []);

    if (contacts.length === 0) {
      hasMore = false;
      break;
    }

    const result = await processContacts(supabase, contacts, orgId, settings, userId, {
      created, duplicates, errors,
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

  return {
    created,
    duplicates,
    errors,
    pages_processed: page,
    segmentation_name: segmentation.name,
  };
}

// ─── HELPER FUNCTIONS ───

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

async function refreshToken(
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

async function processContacts(
  supabase: any,
  contacts: any[],
  orgId: string,
  settings: any,
  userId: string,
  counters: { created: number; duplicates: number; errors: number },
  options?: { skipDuplicateLog?: boolean }
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

      // Check duplicate by email
      if (email) {
        const { data: existingByEmail } = await supabase
          .from("leads")
          .select("id")
          .eq("organization_id", orgId)
          .eq("email", email)
          .limit(1)
          .maybeSingle();

        if (existingByEmail) {
          duplicates++;
          if (!options?.skipDuplicateLog) {
            await supabase.from("rd_station_webhook_logs").insert({
              organization_id: orgId,
              event_type: "api_sync",
              payload: { name, email, phone, rd_uuid: contact.uuid },
              status: "duplicate",
              error_message: "Duplicado por email",
            });
          }
          continue;
        }
      }

      // Check duplicate by phone (normalized, digits only, min 8 chars)
      if (phone) {
        const normalizedPhone = phone.replace(/\D/g, "");
        if (normalizedPhone.length >= 8) {
          const { data: existingLeads } = await supabase
            .from("leads")
            .select("id, phone")
            .eq("organization_id", orgId)
            .not("phone", "is", null);

          const phoneMatch = (existingLeads || []).find((l: any) => {
            const lPhone = (l.phone || "").replace(/\D/g, "");
            return lPhone.length >= 8 && (
              lPhone === normalizedPhone ||
              lPhone.endsWith(normalizedPhone) ||
              normalizedPhone.endsWith(lPhone)
            );
          });

          if (phoneMatch) {
            duplicates++;
            if (!options?.skipDuplicateLog) {
              await supabase.from("rd_station_webhook_logs").insert({
                organization_id: orgId,
                event_type: "api_sync",
                payload: { name, email, phone, rd_uuid: contact.uuid },
                status: "duplicate",
                error_message: "Duplicado por telefone",
              });
            }
            continue;
          }
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

        // Notify org managers about new RD Station lead
        if (newLead?.id) {
          const { data: managers } = await supabase
            .from("user_roles")
            .select("user_id")
            .in("role", ["admin", "sub_admin"]);

          for (const mgr of (managers || [])) {
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
                p_message: `O lead "${name}" foi sincronizado do RD Station.`,
                p_entity_id: newLead.id,
                p_entity_type: "lead",
              });
            }
          }
        }

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
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

    // Refresh token if expired
    if (settings.oauth_token_expires_at) {
      const expiresAt = new Date(settings.oauth_token_expires_at);
      if (expiresAt < new Date()) {
        const refreshResult = await refreshToken(supabase, settings, orgId);
        if (refreshResult.error) {
          return new Response(
            JSON.stringify({ error: "Token expirado.", needs_oauth: true }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        accessToken = refreshResult.access_token!;
      }
    }

    const apiHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    };

    // Get segmentations
    const segRes = await fetch("https://api.rd.services/platform/segmentations", { headers: apiHeaders });
    if (!segRes.ok) {
      return new Response(JSON.stringify({ error: `Erro ao listar segmentações (${segRes.status})` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all contacts (up to 5 pages)
    const allContacts: any[] = [];
    let page = 1;
    const pageSize = 125;
    const maxPages = 5;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const url = `https://api.rd.services/platform/segmentations/${segmentation.id}/contacts?page=${page}&page_size=${pageSize}`;
      const res = await fetch(url, { headers: apiHeaders });
      if (!res.ok) break;
      const data = await res.json();
      const contacts = Array.isArray(data?.contacts) ? data.contacts : (Array.isArray(data) ? data : []);
      if (contacts.length === 0) break;
      allContacts.push(...contacts);
      hasMore = typeof data?.has_more === "boolean" ? data.has_more : contacts.length >= pageSize;
      page++;
    }

    // Fetch existing leads for duplicate check
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("id, email, phone, name, external_id")
      .eq("organization_id", orgId);

    const existingEmails = new Set(
      (existingLeads || []).filter((l: any) => l.email).map((l: any) => l.email.toLowerCase())
    );
    const existingPhones = (existingLeads || [])
      .filter((l: any) => l.phone)
      .map((l: any) => ({ id: l.id, phone: l.phone.replace(/\D/g, "") }));
    const existingExternalIds = new Set(
      (existingLeads || []).filter((l: any) => l.external_id).map((l: any) => l.external_id)
    );

    // Map contacts with duplicate status
    const mappedContacts = allContacts.map((contact: any) => {
      const email = contact.email || null;
      const name = contact.name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Lead RD Station";
      const phone = contact.personal_phone || contact.mobile_phone || null;
      const normalizedPhone = phone ? phone.replace(/\D/g, "") : "";

      let existsInCRM = false;
      let existingLeadId: string | null = null;

      // Check by external_id
      if (contact.uuid && existingExternalIds.has(contact.uuid)) {
        existsInCRM = true;
        const match = (existingLeads || []).find((l: any) => l.external_id === contact.uuid);
        if (match) existingLeadId = match.id;
      }

      // Check by email
      if (!existsInCRM && email && existingEmails.has(email.toLowerCase())) {
        existsInCRM = true;
        const match = (existingLeads || []).find((l: any) => l.email?.toLowerCase() === email.toLowerCase());
        if (match) existingLeadId = match.id;
      }

      // Check by phone
      if (!existsInCRM && normalizedPhone.length >= 8) {
        const phoneMatch = existingPhones.find((p: any) =>
          p.phone.length >= 8 && (
            p.phone === normalizedPhone ||
            p.phone.endsWith(normalizedPhone) ||
            normalizedPhone.endsWith(p.phone)
          )
        );
        if (phoneMatch) {
          existsInCRM = true;
          existingLeadId = phoneMatch.id;
        }
      }

      return {
        uuid: contact.uuid || null,
        name,
        email,
        phone,
        company: contact.company || null,
        job_title: contact.job_title || null,
        tags: contact.tags || [],
        existsInCRM,
        existingLeadId,
      };
    });

    return new Response(
      JSON.stringify({
        contacts: mappedContacts,
        total: mappedContacts.length,
        segmentation_name: segmentation.name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("RD Station list contacts error:", err);
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
): Promise<{ error?: string; access_token?: string }> {
  try {
    const clientId = Deno.env.get("RD_STATION_CLIENT_ID");
    const clientSecret = Deno.env.get("RD_STATION_CLIENT_SECRET");

    if (!clientId || !clientSecret || !settings.oauth_refresh_token) {
      return { error: "Missing OAuth credentials" };
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

    if (!res.ok) return { error: `Refresh failed: ${res.status}` };

    const data = await res.json();
    const expiresAt = new Date(Date.now() + (data.expires_in || 86400) * 1000).toISOString();

    await supabase
      .from("rd_station_settings")
      .update({
        oauth_access_token: data.access_token,
        oauth_refresh_token: data.refresh_token || settings.oauth_refresh_token,
        oauth_token_expires_at: expiresAt,
      })
      .eq("organization_id", orgId);

    return { access_token: data.access_token };
  } catch (err: any) {
    return { error: err.message };
  }
}

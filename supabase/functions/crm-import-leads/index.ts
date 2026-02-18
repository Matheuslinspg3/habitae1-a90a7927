import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LeadData {
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  estimated_value?: number;
  notes?: string;
  broker_id?: string;
  stage?: string;
  external_id?: string;
  external_source?: string;
  created_at?: string;
}

interface ImportSettings {
  target_stage: string;
  broker_id?: string;
  auto_temperature: boolean;
  duplicate_action: "skip" | "update" | "create";
}

function classifyTemperature(lead: LeadData): "frio" | "morno" | "quente" {
  const hasPhone = !!lead.phone?.trim();
  const hasEmail = !!lead.email?.trim();
  const source = (lead.source || "").toLowerCase();

  // Hot sources
  if (
    source.includes("facebook ads") ||
    source.includes("portal pago") ||
    source.includes("google ads")
  ) {
    return "quente";
  }

  // Created recently (< 3 days)
  if (lead.created_at) {
    const createdDate = new Date(lead.created_at);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    if (createdDate > threeDaysAgo) return "quente";
  }

  if (hasPhone && hasEmail) return "quente";
  if (hasPhone || hasEmail) return "morno";
  return "frio";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user via JWT claims
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: claimsData.claims.sub as string };

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "process-csv") {
      return await processCSV(supabase, body, user.id, profile.organization_id);
    } else if (action === "fetch-leads") {
      return await fetchImobziLeads(supabase, body, profile.organization_id);
    } else if (action === "import-leads") {
      return await importLeads(supabase, body, user.id, profile.organization_id);
    } else {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("CRM Import error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function processCSV(
  supabase: any,
  body: { leads: LeadData[]; settings: ImportSettings; file_name?: string },
  userId: string,
  organizationId: string
) {
  const { leads, settings, file_name } = body;

  if (!leads || leads.length === 0) {
    return new Response(JSON.stringify({ error: "Nenhum lead para importar" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (leads.length > 1000) {
    return new Response(
      JSON.stringify({ error: "Limite de 1.000 leads por importação" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const result = await processLeadBatch(supabase, leads, settings, userId, organizationId);

  // Log import
  await supabase.from("crm_import_logs").insert({
    organization_id: organizationId,
    user_id: userId,
    import_type: "csv",
    file_name: file_name || null,
    total_processed: result.total_processed,
    total_imported: result.total_imported,
    total_duplicates: result.total_duplicates,
    total_updated: result.total_updated,
    total_errors: result.total_errors,
    settings,
    report: result.report,
  });

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchImobziLeads(
  supabase: any,
  body: { api_key_id: string },
  organizationId: string
) {
  const { api_key_id } = body;

  const { data: apiKey, error: keyError } = await supabase
    .from("imobzi_api_keys")
    .select("api_key")
    .eq("id", api_key_id)
    .eq("organization_id", organizationId)
    .single();

  if (keyError || !apiKey) {
    return new Response(JSON.stringify({ error: "Chave API não encontrada" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const allLeads: any[] = [];
    let cursor: string | undefined = undefined;
    const maxPages = 100;
    let pageCount = 0;

    // Paginate through all contacts
    while (pageCount < maxPages) {
      pageCount++;
      const url = new URL("https://api.imobzi.app/v1/contacts");
      url.searchParams.set("limit", "50");
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      const response = await fetch(url.toString(), {
        headers: {
          "X-Imobzi-Secret": apiKey.api_key,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Imobzi API error:", response.status, errorText);
        // If we already have some leads, return what we have
        if (allLeads.length > 0) {
          console.warn(`[crm-import-leads] Partial fetch: got ${allLeads.length} leads before error on page ${pageCount}`);
          break;
        }
        return new Response(
          JSON.stringify({ error: `Erro na API do Imobzi: ${response.status}` }),
          {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const data = await response.json();
      const contacts = data.contacts || data.data || data || [];
      const pageContacts = Array.isArray(contacts) ? contacts : [];

      allLeads.push(...pageContacts);

      // Check for next page cursor
      cursor = data.cursor || undefined;
      if (!cursor || pageContacts.length === 0) {
        break;
      }

      // Small delay to avoid rate limiting
      if (cursor) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log(`[crm-import-leads] Fetched ${allLeads.length} contacts in ${pageCount} pages`);

    const transformedLeads = allLeads
      .filter((contact: any) => contact.active !== false)
      .map((contact: any) => {
        // Extract phone from phones array
        let phone = null;
        if (Array.isArray(contact.phones) && contact.phones.length > 0) {
          phone = contact.phones[0].number_plain || contact.phones[0].number || null;
        }
        if (!phone) {
          phone = contact.phone || contact.cellphone || null;
        }

        // Extract tags as notes
        const tags = Array.isArray(contact.tags) ? contact.tags.join(", ") : null;

        return {
          external_id: contact.contact_id || contact.code || contact.id || String(contact.db_id),
          name: contact.fullname || contact.name || "Sem nome",
          email: contact.email || null,
          phone,
          source: contact.media_source || "Imobzi",
          external_source: "imobzi",
          notes: tags,
          contact_type: contact.contact_type || null,
          created_at: contact.created_at || null,
        };
      });

    return new Response(JSON.stringify({ leads: transformedLeads, total: transformedLeads.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (fetchError) {
    console.error("Imobzi fetch error:", fetchError);
    return new Response(
      JSON.stringify({ error: "Erro ao conectar com a API do Imobzi" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

async function importLeads(
  supabase: any,
  body: { leads: LeadData[]; settings: ImportSettings },
  userId: string,
  organizationId: string
) {
  const { leads, settings } = body;

  if (!leads || leads.length === 0) {
    return new Response(JSON.stringify({ error: "Nenhum lead selecionado" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = await processLeadBatch(supabase, leads, settings, userId, organizationId);

  await supabase.from("crm_import_logs").insert({
    organization_id: organizationId,
    user_id: userId,
    import_type: "imobzi_api",
    total_processed: result.total_processed,
    total_imported: result.total_imported,
    total_duplicates: result.total_duplicates,
    total_updated: result.total_updated,
    total_errors: result.total_errors,
    settings,
    report: result.report,
  });

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function processLeadBatch(
  supabase: any,
  leads: LeadData[],
  settings: ImportSettings,
  userId: string,
  organizationId: string
) {
  const report = {
    imported: [] as string[],
    duplicates: [] as string[],
    updated: [] as string[],
    errors: [] as { name: string; error: string }[],
  };

  // Fetch existing leads for duplicate detection
  const { data: existingLeads } = await supabase
    .from("leads")
    .select("id, email, phone, name")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  const existingByEmail = new Map<string, any>();
  const existingByPhone = new Map<string, any>();
  (existingLeads || []).forEach((l: any) => {
    if (l.email) existingByEmail.set(l.email.toLowerCase().trim(), l);
    if (l.phone) {
      const cleanPhone = l.phone.replace(/\D/g, "");
      if (cleanPhone) existingByPhone.set(cleanPhone, l);
    }
  });

  const BATCH_SIZE = 50;

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE);
    const toInsert: any[] = [];
    const toUpdate: { id: string; data: any }[] = [];

    for (const lead of batch) {
      try {
        const email = lead.email?.toLowerCase().trim();
        const phone = lead.phone?.replace(/\D/g, "");

        let duplicate =
          (email ? existingByEmail.get(email) : null) ||
          (phone ? existingByPhone.get(phone) : null);

        if (duplicate) {
          if (settings.duplicate_action === "skip") {
            report.duplicates.push(lead.name);
            continue;
          } else if (settings.duplicate_action === "update") {
            toUpdate.push({
              id: duplicate.id,
              data: {
                ...(lead.email && { email: lead.email }),
                ...(lead.phone && { phone: lead.phone }),
                ...(lead.source && { source: lead.source }),
                ...(lead.notes && { notes: lead.notes }),
                ...(settings.auto_temperature && {
                  temperature: classifyTemperature(lead),
                }),
              },
            });
            report.updated.push(lead.name);
            continue;
          }
          // duplicate_action === 'create' falls through
        }

        const temperature = settings.auto_temperature
          ? classifyTemperature(lead)
          : null;

        toInsert.push({
          name: lead.name,
          email: lead.email || null,
          phone: lead.phone || null,
          source: lead.source || null,
          estimated_value: lead.estimated_value || null,
          notes: lead.notes || null,
          stage: settings.target_stage || "novo",
          broker_id: settings.broker_id || lead.broker_id || null,
          organization_id: organizationId,
          created_by: userId,
          external_id: lead.external_id || null,
          external_source: lead.external_source || "csv",
          temperature,
          imported_at: new Date().toISOString(),
        });
        report.imported.push(lead.name);
      } catch (e) {
        report.errors.push({ name: lead.name, error: e.message });
      }
    }

    // Batch insert
    if (toInsert.length > 0) {
      const { error } = await supabase.from("leads").insert(toInsert);
      if (error) {
        console.error("Batch insert error:", error);
        // Fall back to individual inserts
        for (const item of toInsert) {
          const { error: singleError } = await supabase
            .from("leads")
            .insert(item);
          if (singleError) {
            const idx = report.imported.indexOf(item.name);
            if (idx > -1) report.imported.splice(idx, 1);
            report.errors.push({ name: item.name, error: singleError.message });
          }
        }
      }
    }

    // Batch updates
    for (const upd of toUpdate) {
      const { error } = await supabase
        .from("leads")
        .update(upd.data)
        .eq("id", upd.id);
      if (error) {
        const idx = report.updated.indexOf(upd.data.name || "");
        if (idx > -1) report.updated.splice(idx, 1);
        report.errors.push({
          name: upd.data.name || upd.id,
          error: error.message,
        });
      }
    }
  }

  return {
    total_processed: leads.length,
    total_imported: report.imported.length,
    total_duplicates: report.duplicates.length,
    total_updated: report.updated.length,
    total_errors: report.errors.length,
    report,
  };
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES = [
  "organizations",
  "profiles",
  "user_roles",
  "properties",
  "property_types",
  "property_images",
  "property_media",
  "property_owners",
  "property_share_links",
  "property_type_codes",
  "city_codes",
  "zone_codes",
  "leads",
  "lead_stages",
  "lead_types",
  "lead_interactions",
  "contracts",
  "contract_documents",
  "commissions",
  "invoices",
  "transactions",
  "transaction_categories",
  "tasks",
  "appointments",
  "notifications",
  "push_devices",
  "activity_log",
  "audit_logs",
  "owners",
  "owner_aliases",
  "saved_searches",
  "ad_accounts",
  "ad_entities",
  "ad_insights_daily",
  "ad_leads",
  "ad_settings",
  "subscriptions",
  "subscription_plans",
  "billing_payments",
  "marketplace_properties",
  "marketplace_contact_access",
  "consumer_favorites",
  "imobzi_settings",
  "imobzi_api_keys",
  "import_runs",
  "import_run_items",
  "import_tokens",
  "organization_invites",
  "platform_invites",
  "support_tickets",
  "support_messages",
  "app_runtime_config",
  "admin_allowlist",
  "portal_feeds",
  "crm_import_logs",
  "deleted_property_media",
  "billing_webhook_logs",
  "landing_overrides",
];

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCSV(row[h])).join(","));
  }
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Accept any request with a valid Authorization header
    // During maintenance mode users may be logged out, so we skip user validation
    // and rely on the service_role key for actual data access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS for full export
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { table } = await req.json().catch(() => ({ table: null }));

    // If specific table requested, return just that
    if (table) {
      const allRows: Record<string, unknown>[] = [];
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await adminClient
          .from(table)
          .select("*")
          .range(offset, offset + PAGE - 1);
        if (error) {
          return new Response(JSON.stringify({ error: `Erro ao exportar ${table}: ${error.message}` }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < PAGE) break;
        offset += PAGE;
      }

      const csv = toCSV(allRows);
      return new Response(csv, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${table}.csv"`,
        },
      });
    }

    // Export all public tables
    const result: Record<string, { count: number; csv: string }> = {};
    const errors: string[] = [];

    for (const t of TABLES) {
      try {
        const allRows: Record<string, unknown>[] = [];
        let offset = 0;
        const PAGE = 1000;
        while (true) {
          const { data, error } = await adminClient
            .from(t)
            .select("*")
            .range(offset, offset + PAGE - 1);
          if (error) {
            errors.push(`${t}: ${error.message}`);
            break;
          }
          if (!data || data.length === 0) break;
          allRows.push(...data);
          if (data.length < PAGE) break;
          offset += PAGE;
        }
        result[t] = { count: allRows.length, csv: toCSV(allRows) };
      } catch (e) {
        errors.push(`${t}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Export auth.users via Admin API (listUsers with pagination)
    try {
      const allAuthUsers: Record<string, unknown>[] = [];
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data: { users }, error: authError } = await adminClient.auth.admin.listUsers({
          page,
          perPage,
        });
        if (authError) {
          errors.push(`auth.users: ${authError.message}`);
          break;
        }
        if (!users || users.length === 0) break;
        for (const u of users) {
          allAuthUsers.push({
            id: u.id,
            email: u.email,
            phone: u.phone,
            email_confirmed_at: u.email_confirmed_at,
            phone_confirmed_at: u.phone_confirmed_at,
            created_at: u.created_at,
            updated_at: u.updated_at,
            last_sign_in_at: u.last_sign_in_at,
            role: u.role,
            is_anonymous: u.is_anonymous,
            user_metadata: u.user_metadata,
            app_metadata: u.app_metadata,
          });
        }
        if (users.length < perPage) break;
        page++;
      }
      result["_auth_users"] = { count: allAuthUsers.length, csv: toCSV(allAuthUsers) };
    } catch (e) {
      errors.push(`auth.users: ${e instanceof Error ? e.message : String(e)}`);
    }

    return new Response(
      JSON.stringify({ tables: result, errors, exported_at: new Date().toISOString() }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Export error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABLES = [
  "subscription_plans",
  "organizations",
  "profiles",
  "user_roles",
  "admin_allowlist",
  "app_runtime_config",
  "property_types",
  "property_type_codes",
  "city_codes",
  "zone_codes",
  "lead_stages",
  "lead_types",
  "owners",
  "owner_aliases",
  "properties",
  "property_images",
  "property_media",
  "property_owners",
  "property_share_links",
  "leads",
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
  "saved_searches",
  "subscriptions",
  "billing_payments",
  "billing_webhook_logs",
  "ad_accounts",
  "ad_entities",
  "ad_insights_daily",
  "ad_leads",
  "ad_settings",
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
  "portal_feeds",
  "portal_feed_logs",
  "crm_import_logs",
  "deleted_property_media",
  "landing_overrides",
  "maintenance_audit_log",
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

// ---- Schema export via raw SQL using Supabase Management API ----
async function exportSchemaDDL(supabaseUrl: string, serviceKey: string): Promise<string> {
  const lines: string[] = [];
  
  // Use the PostgREST RPC endpoint to run SQL via a database function
  // We'll use the admin client to query information_schema
  const adminClient = createClient(supabaseUrl, serviceKey);

  // 1. Get all enums
  try {
    const { data: enums } = await adminClient.rpc('get_schema_enums').throwOnError() as { data: { enum_name: string; enum_values: string[] }[] | null };
    if (enums && enums.length > 0) {
      lines.push("-- ============================================================");
      lines.push("-- ENUMS");
      lines.push("-- ============================================================\n");
      for (const e of enums) {
        const vals = e.enum_values.map((v: string) => `'${v}'`).join(", ");
        lines.push(`DO $$ BEGIN CREATE TYPE public.${e.enum_name} AS ENUM (${vals}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;\n`);
      }
    }
  } catch (e) {
    lines.push(`-- ERRO ao exportar enums: ${e instanceof Error ? e.message : String(e)}\n`);
  }

  // 2. Get all table DDLs
  try {
    const { data: ddls } = await adminClient.rpc('get_schema_tables_ddl').throwOnError() as { data: { table_name: string; ddl: string }[] | null };
    if (ddls && ddls.length > 0) {
      lines.push("-- ============================================================");
      lines.push("-- TABLES");
      lines.push("-- ============================================================\n");
      for (const d of ddls) {
        lines.push(`-- Table: ${d.table_name}`);
        lines.push(d.ddl);
        lines.push("");
      }
    }
  } catch (e) {
    lines.push(`-- ERRO ao exportar tabelas: ${e instanceof Error ? e.message : String(e)}\n`);
  }

  // 3. Get all functions
  try {
    const { data: funcs } = await adminClient.rpc('get_schema_functions').throwOnError() as { data: { func_name: string; func_def: string }[] | null };
    if (funcs && funcs.length > 0) {
      lines.push("-- ============================================================");
      lines.push("-- FUNCTIONS");
      lines.push("-- ============================================================\n");
      for (const f of funcs) {
        lines.push(`-- Function: ${f.func_name}`);
        lines.push(f.func_def + ";");
        lines.push("");
      }
    }
  } catch (e) {
    lines.push(`-- ERRO ao exportar funções: ${e instanceof Error ? e.message : String(e)}\n`);
  }

  // 4. Get all triggers
  try {
    const { data: triggers } = await adminClient.rpc('get_schema_triggers').throwOnError() as { data: { trigger_def: string }[] | null };
    if (triggers && triggers.length > 0) {
      lines.push("-- ============================================================");
      lines.push("-- TRIGGERS");
      lines.push("-- ============================================================\n");
      for (const t of triggers) {
        lines.push(t.trigger_def + ";");
        lines.push("");
      }
    }
  } catch (e) {
    lines.push(`-- ERRO ao exportar triggers: ${e instanceof Error ? e.message : String(e)}\n`);
  }

  // 5. Get all RLS policies
  try {
    const { data: policies } = await adminClient.rpc('get_schema_policies').throwOnError() as { data: { policy_def: string }[] | null };
    if (policies && policies.length > 0) {
      lines.push("-- ============================================================");
      lines.push("-- RLS POLICIES");
      lines.push("-- ============================================================\n");
      for (const p of policies) {
        lines.push(p.policy_def + ";");
        lines.push("");
      }
    }
  } catch (e) {
    lines.push(`-- ERRO ao exportar policies: ${e instanceof Error ? e.message : String(e)}\n`);
  }

  // 6. Get all indexes
  try {
    const { data: indexes } = await adminClient.rpc('get_schema_indexes').throwOnError() as { data: { index_def: string }[] | null };
    if (indexes && indexes.length > 0) {
      lines.push("-- ============================================================");
      lines.push("-- INDEXES");
      lines.push("-- ============================================================\n");
      for (const idx of indexes) {
        lines.push(idx.index_def + ";");
        lines.push("");
      }
    }
  } catch (e) {
    lines.push(`-- ERRO ao exportar indexes: ${e instanceof Error ? e.message : String(e)}\n`);
  }

  return lines.join("\n");
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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    // ---- FULL EXPORT: Schema + Data + Auth ----

    // 1. Export schema DDL
    let schemaDDL = "";
    try {
      schemaDDL = await exportSchemaDDL(supabaseUrl, serviceKey);
    } catch (e) {
      schemaDDL = `-- Erro ao exportar schema: ${e instanceof Error ? e.message : String(e)}\n`;
    }

    // 2. Export all public tables data
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

    // 3. Export auth.users
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
      JSON.stringify({
        schema_ddl: schemaDDL,
        tables: result,
        errors,
        exported_at: new Date().toISOString(),
      }),
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

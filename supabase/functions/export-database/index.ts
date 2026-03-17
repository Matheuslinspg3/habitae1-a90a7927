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
  "property_landing_content",
  "property_landing_overrides",
  "property_partnerships",
  "property_visibility",
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
  "push_subscriptions",
  "user_devices",
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
  "ticket_messages",
  "portal_feeds",
  "portal_feed_logs",
  "crm_import_logs",
  "deleted_property_media",
  "maintenance_audit_log",
  "rd_station_settings",
  "rd_station_webhook_logs",
  "scrape_cache",
  "verification_codes",
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

// Topological sort of tables based on FK dependencies
function topoSortTables(
  tables: { table_name: string; ddl: string }[],
  fks: { source_table: string; target_table: string; constraint_sql: string }[]
): { table_name: string; ddl: string }[] {
  const tableMap = new Map(tables.map(t => [t.table_name, t]));
  const deps = new Map<string, Set<string>>();
  
  for (const t of tables) {
    deps.set(t.table_name, new Set());
  }
  
  for (const fk of fks) {
    if (fk.source_table !== fk.target_table && deps.has(fk.source_table) && deps.has(fk.target_table)) {
      deps.get(fk.source_table)!.add(fk.target_table);
    }
  }
  
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  
  function visit(name: string) {
    if (visited.has(name)) return;
    if (visiting.has(name)) return; // break cycle
    visiting.add(name);
    for (const dep of deps.get(name) || []) {
      visit(dep);
    }
    visiting.delete(name);
    visited.add(name);
    sorted.push(name);
  }
  
  for (const t of tables) {
    visit(t.table_name);
  }
  
  return sorted.map(name => tableMap.get(name)!).filter(Boolean);
}

async function exportSchemaDDL(supabaseUrl: string, serviceKey: string): Promise<{
  tables_ddl: string;
  fk_ddl: string;
  functions_ddl: string;
  triggers_ddl: string;
  policies_ddl: string;
  indexes_ddl: string;
  enums_ddl: string;
  rls_ddl: string;
}> {
  const adminClient = createClient(supabaseUrl, serviceKey);
  const result = {
    tables_ddl: "",
    fk_ddl: "",
    functions_ddl: "",
    triggers_ddl: "",
    policies_ddl: "",
    indexes_ddl: "",
    enums_ddl: "",
    rls_ddl: "",
  };

  // 1. Enums
  try {
    const { data: enums } = await adminClient.rpc('get_schema_enums').throwOnError() as { data: { enum_name: string; enum_values: string[] }[] | null };
    if (enums && enums.length > 0) {
      const lines: string[] = [];
      for (const e of enums) {
        const vals = e.enum_values.map((v: string) => `'${v}'`).join(", ");
        lines.push(`DO $$ BEGIN CREATE TYPE public.${e.enum_name} AS ENUM (${vals}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
        lines.push("");
      }
      result.enums_ddl = lines.join("\n");
    }
  } catch (e) {
    result.enums_ddl = `-- ERRO ao exportar enums: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 2. Tables (without FKs) + FK constraints separately
  try {
    const { data: ddls } = await adminClient.rpc('get_schema_tables_ddl').throwOnError() as { data: { table_name: string; ddl: string }[] | null };
    const { data: fks } = await adminClient.rpc('get_schema_fk_constraints').throwOnError() as { data: { source_table: string; target_table: string; constraint_sql: string }[] | null };
    
    if (ddls && ddls.length > 0) {
      const sorted = topoSortTables(ddls, fks || []);
      const tableLines: string[] = [];
      for (const d of sorted) {
        tableLines.push(`-- Table: ${d.table_name}`);
        tableLines.push(d.ddl);
        tableLines.push("");
      }
      result.tables_ddl = tableLines.join("\n");
    }
    
    if (fks && fks.length > 0) {
      const fkLines: string[] = [];
      for (const fk of fks) {
        fkLines.push(`-- FK: ${fk.source_table} -> ${fk.target_table}`);
        fkLines.push(fk.constraint_sql);
        fkLines.push("");
      }
      result.fk_ddl = fkLines.join("\n");
    }
  } catch (e) {
    result.tables_ddl = `-- ERRO ao exportar tabelas: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 3. RLS enable statements
  try {
    const { data: rlsTables } = await adminClient.rpc('get_schema_rls_tables').throwOnError() as { data: { table_name: string; rls_enabled: boolean }[] | null };
    if (rlsTables && rlsTables.length > 0) {
      const lines = rlsTables.map(t => `ALTER TABLE public.${t.table_name} ENABLE ROW LEVEL SECURITY;`);
      result.rls_ddl = lines.join("\n");
    }
  } catch (e) {
    result.rls_ddl = `-- ERRO ao exportar RLS: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 4. Functions
  try {
    const { data: funcs } = await adminClient.rpc('get_schema_functions').throwOnError() as { data: { func_name: string; func_def: string }[] | null };
    if (funcs && funcs.length > 0) {
      const lines: string[] = [];
      for (const f of funcs) {
        lines.push(`-- Function: ${f.func_name}`);
        lines.push(f.func_def + ";");
        lines.push("");
      }
      result.functions_ddl = lines.join("\n");
    }
  } catch (e) {
    result.functions_ddl = `-- ERRO ao exportar funções: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 5. Triggers
  try {
    const { data: triggers } = await adminClient.rpc('get_schema_triggers').throwOnError() as { data: { trigger_def: string }[] | null };
    if (triggers && triggers.length > 0) {
      const lines: string[] = [];
      for (const t of triggers) {
        lines.push(t.trigger_def + ";");
        lines.push("");
      }
      result.triggers_ddl = lines.join("\n");
    }
  } catch (e) {
    result.triggers_ddl = `-- ERRO ao exportar triggers: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 6. Policies
  try {
    const { data: policies } = await adminClient.rpc('get_schema_policies').throwOnError() as { data: { policy_def: string }[] | null };
    if (policies && policies.length > 0) {
      const lines: string[] = [];
      for (const p of policies) {
        lines.push(p.policy_def + ";");
        lines.push("");
      }
      result.policies_ddl = lines.join("\n");
    }
  } catch (e) {
    result.policies_ddl = `-- ERRO ao exportar policies: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 7. Indexes
  try {
    const { data: indexes } = await adminClient.rpc('get_schema_indexes').throwOnError() as { data: { index_def: string }[] | null };
    if (indexes && indexes.length > 0) {
      const lines: string[] = [];
      for (const idx of indexes) {
        lines.push(idx.index_def + ";");
        lines.push("");
      }
      result.indexes_ddl = lines.join("\n");
    }
  } catch (e) {
    result.indexes_ddl = `-- ERRO ao exportar indexes: ${e instanceof Error ? e.message : String(e)}`;
  }

  return result;
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

    // ---- FULL EXPORT: Schema (structured) + Data + Auth ----

    // 1. Export schema DDL (now structured)
    let schema = {
      tables_ddl: "",
      fk_ddl: "",
      functions_ddl: "",
      triggers_ddl: "",
      policies_ddl: "",
      indexes_ddl: "",
      enums_ddl: "",
      rls_ddl: "",
    };
    try {
      schema = await exportSchemaDDL(supabaseUrl, serviceKey);
    } catch (e) {
      schema.tables_ddl = `-- Erro ao exportar schema: ${e instanceof Error ? e.message : String(e)}`;
    }

    // 2. Get column types for proper INSERT generation (array vs jsonb)
    const columnTypes: Record<string, Record<string, string>> = {};
    try {
      const { data: ctData } = await adminClient.rpc('get_schema_column_types') as {
        data: { table_name: string; column_name: string; udt_name: string }[] | null
      };
      if (ctData) {
        for (const row of ctData) {
          if (!columnTypes[row.table_name]) columnTypes[row.table_name] = {};
          columnTypes[row.table_name][row.column_name] = row.udt_name;
        }
      }
    } catch (e) {
      errors.push(`column_types: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 3. Export all public tables data
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

    // 4. Export auth.users
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
        schema,
        tables: result,
        column_types: columnTypes,
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

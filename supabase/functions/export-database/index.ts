import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

function topoSortTables(
  tables: { table_name: string; ddl: string }[],
  fks: { source_table: string; target_table: string; constraint_sql: string }[]
): { table_name: string; ddl: string }[] {
  const tableMap = new Map(tables.map(t => [t.table_name, t]));
  const deps = new Map<string, Set<string>>();
  for (const t of tables) deps.set(t.table_name, new Set());
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
    if (visiting.has(name)) return;
    visiting.add(name);
    for (const dep of deps.get(name) || []) visit(dep);
    visiting.delete(name);
    visited.add(name);
    sorted.push(name);
  }
  for (const t of tables) visit(t.table_name);
  return sorted.map(name => tableMap.get(name)!).filter(Boolean);
}

async function exportSchemaDDL(supabaseUrl: string, serviceKey: string) {
  const adminClient = createClient(supabaseUrl, serviceKey);
  const result = {
    tables_ddl: "", fk_ddl: "", functions_ddl: "", triggers_ddl: "",
    policies_ddl: "", indexes_ddl: "", enums_ddl: "", rls_ddl: "",
  };

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
  } catch (e) { result.enums_ddl = `-- ERRO: ${e instanceof Error ? e.message : String(e)}`; }

  try {
    const { data: ddls } = await adminClient.rpc('get_schema_tables_ddl').throwOnError() as { data: { table_name: string; ddl: string }[] | null };
    const { data: fks } = await adminClient.rpc('get_schema_fk_constraints').throwOnError() as { data: { source_table: string; target_table: string; constraint_sql: string }[] | null };
    if (ddls && ddls.length > 0) {
      const sorted = topoSortTables(ddls, fks || []);
      result.tables_ddl = sorted.map(d => `-- Table: ${d.table_name}\n${d.ddl}\n`).join("\n");
    }
    if (fks && fks.length > 0) {
      result.fk_ddl = fks.map(fk => `-- FK: ${fk.source_table} -> ${fk.target_table}\n${fk.constraint_sql}\n`).join("\n");
    }
  } catch (e) { result.tables_ddl = `-- ERRO: ${e instanceof Error ? e.message : String(e)}`; }

  try {
    const { data: rlsTables } = await adminClient.rpc('get_schema_rls_tables').throwOnError() as { data: { table_name: string; rls_enabled: boolean }[] | null };
    if (rlsTables && rlsTables.length > 0) {
      result.rls_ddl = rlsTables.map(t => `ALTER TABLE public.${t.table_name} ENABLE ROW LEVEL SECURITY;`).join("\n");
    }
  } catch (e) { result.rls_ddl = `-- ERRO: ${e instanceof Error ? e.message : String(e)}`; }

  try {
    const { data: funcs } = await adminClient.rpc('get_schema_functions').throwOnError() as { data: { func_name: string; func_def: string }[] | null };
    if (funcs && funcs.length > 0) {
      result.functions_ddl = funcs.map(f => `-- Function: ${f.func_name}\n${f.func_def};\n`).join("\n");
    }
  } catch (e) { result.functions_ddl = `-- ERRO: ${e instanceof Error ? e.message : String(e)}`; }

  try {
    const { data: triggers } = await adminClient.rpc('get_schema_triggers').throwOnError() as { data: { trigger_def: string }[] | null };
    if (triggers && triggers.length > 0) {
      result.triggers_ddl = triggers.map(t => `${t.trigger_def};\n`).join("\n");
    }
  } catch (e) { result.triggers_ddl = `-- ERRO: ${e instanceof Error ? e.message : String(e)}`; }

  try {
    const { data: policies } = await adminClient.rpc('get_schema_policies').throwOnError() as { data: { policy_def: string }[] | null };
    if (policies && policies.length > 0) {
      result.policies_ddl = policies.map(p => `${p.policy_def};\n`).join("\n");
    }
  } catch (e) { result.policies_ddl = `-- ERRO: ${e instanceof Error ? e.message : String(e)}`; }

  try {
    const { data: indexes } = await adminClient.rpc('get_schema_indexes').throwOnError() as { data: { index_def: string }[] | null };
    if (indexes && indexes.length > 0) {
      result.indexes_ddl = indexes.map(idx => `${idx.index_def};\n`).join("\n");
    }
  } catch (e) { result.indexes_ddl = `-- ERRO: ${e instanceof Error ? e.message : String(e)}`; }

  return result;
}

async function exportTableData(adminClient: ReturnType<typeof createClient>, table: string) {
  const allRows: Record<string, unknown>[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await adminClient.from(table).select("*").range(offset, offset + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return allRows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || (body.table ? "table" : "full");

    // ---- MODE: schema ----
    if (mode === "schema") {
      const schema = await exportSchemaDDL(supabaseUrl, serviceKey);
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
      } catch (_e) { /* ignore */ }

      return new Response(JSON.stringify({ schema, column_types: columnTypes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- MODE: table (single table data as JSON) ----
    if (mode === "table" && body.table) {
      const rows = await exportTableData(adminClient, body.table);
      return new Response(JSON.stringify({ table: body.table, count: rows.length, csv: toCSV(rows) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- MODE: auth ----
    if (mode === "auth") {
      const allAuthUsers: Record<string, unknown>[] = [];
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data: { users }, error: authError } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (authError) throw new Error(`auth.users: ${authError.message}`);
        if (!users || users.length === 0) break;
        for (const u of users) {
          allAuthUsers.push({
            id: u.id, email: u.email, phone: u.phone,
            email_confirmed_at: u.email_confirmed_at, phone_confirmed_at: u.phone_confirmed_at,
            created_at: u.created_at, updated_at: u.updated_at, last_sign_in_at: u.last_sign_in_at,
            role: u.role, is_anonymous: u.is_anonymous,
            user_metadata: u.user_metadata, app_metadata: u.app_metadata,
          });
        }
        if (users.length < perPage) break;
        page++;
      }
      return new Response(JSON.stringify({ table: "_auth_users", count: allAuthUsers.length, csv: toCSV(allAuthUsers) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- MODE: full (legacy, kept for backward compat but may timeout) ----
    return new Response(JSON.stringify({ error: "Use mode=schema, mode=table&table=NAME, or mode=auth for chunked export." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Export error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

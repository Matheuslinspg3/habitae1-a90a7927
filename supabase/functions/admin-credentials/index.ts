import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_ENV_FILTER = new Set([
  "PATH", "HOME", "DENO_DIR", "HOSTNAME", "PORT", "TMPDIR", "USER",
  "LANG", "TERM", "_", "DENO_REGION", "DENO_DEPLOYMENT_ID",
]);

function isSystemVar(key: string): boolean {
  if (SYSTEM_ENV_FILTER.has(key)) return true;
  if (key.startsWith("XDG_")) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    // Validate JWT manually
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Token não fornecido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user has admin or developer role
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roles } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const allowedRoles = ["admin", "developer", "desenvolvedor"];
    const hasPermission = roles?.some((r: any) => allowedRoles.includes(r.role));

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: "Acesso negado: requer role admin ou desenvolvedor" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather all env vars
    const allEnv = Deno.env.toObject();
    const secrets: Record<string, string> = {};
    const credentialKeys = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

    for (const [key, value] of Object.entries(allEnv)) {
      if (isSystemVar(key)) continue;
      if (credentialKeys.includes(key)) continue;
      secrets[key] = value;
    }

    // Discover edge functions via probe
    const knownFunctionNames = [
      "accept-invite", "admin-audit-metrics", "admin-credentials", "admin-subscriptions",
      "admin-users", "ai-billing-stripe", "analyze-photo-quality", "billing",
      "billing-webhook", "cache-drive-image", "cancel-video-job", "cleanup-orphan-media",
      "cloudflare-purge-cache", "cloudinary-cleanup", "cloudinary-image-proxy",
      "cloudinary-purge", "cloudinary-sign", "contract-ai-fill", "crm-import-leads",
      "drive-image-proxy", "export-database", "extract-property-pdf",
      "generate-ad-content", "generate-ad-image", "generate-contract-template",
      "generate-landing-content", "generate-property-art", "generate-property-video",
      "geocode-properties", "imobzi-import", "imobzi-list", "imobzi-process",
      "manage-member", "meta-app-id", "meta-oauth-callback", "meta-save-account",
      "meta-sync-entities", "meta-sync-leads", "migrate-cloudinary-to-r2",
      "migrate-to-r2", "notifications-register-device", "notifications-test",
      "onesignal-app-id", "platform-signup", "portal-xml-feed", "r2-presign",
      "r2-upload", "rd-station-app-id", "rd-station-list-contacts",
      "rd-station-oauth-callback", "rd-station-send-event", "rd-station-stats",
      "rd-station-sync-leads", "rd-station-webhook", "scrape-drive-photos",
      "send-invite-email", "send-push", "send-reset-email", "send-ticket-webhook",
      "storage-metrics", "summarize-lead", "test-ai-connection", "ticket-chat",
      "toggle-maintenance-mode", "transfer-database", "validate-document",
      "verify-creci", "video-job-status", "whatsapp-instance", "whatsapp-send",
    ];

    const probeResults = await Promise.allSettled(
      knownFunctionNames.map(async (name) => {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
            method: "OPTIONS",
            headers: { "Content-Type": "application/json" },
          });
          return { name, exists: res.status < 500 };
        } catch {
          return { name, exists: false };
        }
      })
    );

    const edgeFunctions = probeResults
      .filter((r): r is PromiseFulfilledResult<{ name: string; exists: boolean }> =>
        r.status === "fulfilled" && r.value.exists
      )
      .map((r) => r.value.name);

    // Discover database tables via exec_sql
    let databaseTables: any[] = [];
    try {
      const { data: tablesData, error: tablesError } = await serviceClient.rpc("exec_sql", {
        sql_query: `
          SELECT t.tablename as name, COALESCE(s.n_live_tup, 0)::int as row_count,
            (SELECT count(*)::int FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=t.tablename) as column_count,
            (SELECT string_agg(c.column_name,',') FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=t.tablename AND c.column_name LIKE '%encrypted%') as encrypted_columns,
            EXISTS(SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=t.tablename AND c.column_name='user_id') as has_user_id
          FROM pg_tables t LEFT JOIN pg_stat_user_tables s ON s.relname=t.tablename
          WHERE t.schemaname='public' ORDER BY t.tablename
        `,
      });
      if (!tablesError && tablesData) {
        databaseTables = tablesData;
      }
    } catch (e) {
      console.error("Error fetching tables:", e);
    }

    const result = {
      project_url: supabaseUrl,
      anon_key: supabaseAnonKey,
      service_role_key: supabaseServiceKey,
      secrets,
      edge_functions: edgeFunctions,
      edge_functions_count: edgeFunctions.length,
      database_tables: databaseTables,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

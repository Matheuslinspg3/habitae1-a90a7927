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

  try {
    // Verify caller is authenticated on SOURCE
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin on source
    const sourceUrl = Deno.env.get("SUPABASE_URL")!;
    const sourceAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sourceClient = createClient(sourceUrl, sourceAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin } = await sourceClient.rpc("is_system_admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas admins podem transferir dados" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { remote_url, remote_service_key, mode } = body;

    if (!remote_url || !remote_service_key) {
      return new Response(JSON.stringify({ error: "remote_url e remote_service_key são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client for DESTINATION
    const destClient = createClient(remote_url, remote_service_key);

    // ---- MODE: test ----
    if (mode === "test") {
      // Test connection to remote
      const { data, error } = await destClient.from("profiles").select("count", { count: "exact", head: true });
      if (error && !error.message.includes("does not exist")) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true, message: "Conexão com destino OK" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- MODE: push_auth ----
    if (mode === "push_auth") {
      const { users } = body; // Array of user objects
      if (!users || !Array.isArray(users)) {
        return new Response(JSON.stringify({ error: "users array is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let created = 0;
      let skipped = 0;
      const errors: string[] = [];
      const defaultPassword = body.default_password || "PortaMigra2026!";

      for (const u of users) {
        try {
          const { error } = await destClient.auth.admin.createUser({
            email: u.email,
            phone: u.phone || undefined,
            password: defaultPassword,
            email_confirm: !!u.email_confirmed_at,
            phone_confirm: !!u.phone_confirmed_at,
            user_metadata: u.user_metadata || {},
            app_metadata: u.app_metadata || {},
          });

          if (error) {
            if (error.message.includes("already been registered") || error.message.includes("already exists")) {
              skipped++;
            } else {
              errors.push(`${u.email}: ${error.message}`);
            }
          } else {
            created++;
          }
        } catch (e) {
          errors.push(`${u.email}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      return new Response(JSON.stringify({ created, skipped, errors: errors.slice(0, 20) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- MODE: push_table ----
    if (mode === "push_table") {
      const { table, rows } = body;
      if (!table || !rows || !Array.isArray(rows)) {
        return new Response(JSON.stringify({ error: "table and rows array are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (rows.length === 0) {
        return new Response(JSON.stringify({ inserted: 0, table }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert in batches of 500
      const BATCH = 500;
      let inserted = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error } = await destClient.from(table).upsert(batch, {
          onConflict: "id",
          ignoreDuplicates: true,
        });

        if (error) {
          errors.push(`batch ${Math.floor(i / BATCH)}: ${error.message}`);
        } else {
          inserted += batch.length;
        }
      }

      return new Response(JSON.stringify({ table, inserted, errors: errors.slice(0, 10) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "mode deve ser test, push_auth ou push_table" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Transfer error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from "npm:@supabase/supabase-js@2";

// AH-05: CORS allowlist
const ALLOWED_ORIGINS = (Deno.env.get("APP_ALLOWED_ORIGINS") || "").split(",").map(s => s.trim()).filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is developer
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Unauthorized");
    const user = { id: claimsData.claims.sub as string };

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Check if caller has developer role
    const { data: devRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "developer")
      .maybeSingle();

    if (!devRole) throw new Error("Forbidden: developer role required");

    if (req.method === "GET") {
      // List all users with emails
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;

      const simplifiedUsers = users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
      }));

      return new Response(JSON.stringify(simplifiedUsers), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      const { user_id } = await req.json();
      if (!user_id) throw new Error("user_id required");
      if (user_id === user.id) throw new Error("Cannot delete yourself");

      // Nullify all FK references to this user across tables
      await Promise.all([
        adminClient.from("user_roles").delete().eq("user_id", user_id),
        adminClient.from("profiles").delete().eq("user_id", user_id),
        adminClient.from("organizations").update({ created_by: null }).eq("created_by", user_id),
        adminClient.from("organization_invites").delete().eq("invited_by", user_id),
        adminClient.from("properties").update({ created_by: null } as any).eq("created_by", user_id),
        adminClient.from("properties").update({ captador_id: null } as any).eq("captador_id", user_id),
        adminClient.from("leads").update({ created_by: null } as any).eq("created_by", user_id),
        adminClient.from("leads").update({ broker_id: null } as any).eq("broker_id", user_id),
        adminClient.from("lead_interactions").delete().eq("created_by", user_id),
        adminClient.from("contracts").update({ created_by: null } as any).eq("created_by", user_id),
        adminClient.from("contracts").update({ broker_id: null } as any).eq("broker_id", user_id),
        adminClient.from("contract_documents").delete().eq("uploaded_by", user_id),
        adminClient.from("invoices").update({ created_by: null } as any).eq("created_by", user_id),
        adminClient.from("commissions").update({ broker_id: null } as any).eq("broker_id", user_id),
        adminClient.from("appointments").update({ created_by: null } as any).eq("created_by", user_id),
        adminClient.from("appointments").update({ assigned_to: null }).eq("assigned_to", user_id),
        adminClient.from("tasks").update({ created_by: null } as any).eq("created_by", user_id),
        adminClient.from("tasks").update({ assigned_to: null } as any).eq("assigned_to", user_id),
      ]);

      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) throw new Error(`Delete user failed: ${error.message}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Forbidden") ? 403 : msg.includes("Unauthorized") ? 401 : 400;
    // AH-07: Don't leak internal error details
    const safeMsg = msg.includes("Forbidden") ? "Forbidden" 
      : msg.includes("Unauthorized") ? "Unauthorized"
      : msg.includes("No auth") ? "Unauthorized"
      : "Erro interno";
    console.error("[admin-users] Error:", msg);
    return new Response(JSON.stringify({ error: safeMsg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

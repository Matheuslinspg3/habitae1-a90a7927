import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is system admin or developer
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "No token provided" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some(r => r.role === "developer" || r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "GET") {
      // Fetch all organizations with their users
      const { data: orgs, error: orgsError } = await supabaseAdmin
        .from("organizations")
        .select("id, name, is_active, trial_started_at, trial_ends_at, created_at")
        .order("created_at", { ascending: false });

      if (orgsError) throw orgsError;

      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, email:id, organization_id, phone");

      if (profilesError) throw profilesError;

      // Get user emails from auth
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

      const emailMap: Record<string, string> = {};
      authUsers?.users?.forEach(u => { emailMap[u.id] = u.email || ""; });

      // Group profiles by org
      const result = orgs?.map(org => ({
        ...org,
        users: profiles
          ?.filter(p => p.organization_id === org.id)
          .map(p => ({
            user_id: p.user_id,
            full_name: p.full_name,
            email: emailMap[p.user_id] || "",
            phone: p.phone,
          })) || [],
      }));

      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "PATCH") {
      const { org_id, trial_ends_at, trial_started_at } = await req.json();
      
      const updateData: Record<string, string | null> = { trial_ends_at };
      if (trial_started_at) updateData.trial_started_at = trial_started_at;

      const { error } = await supabaseAdmin
        .from("organizations")
        .update(updateData)
        .eq("id", org_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

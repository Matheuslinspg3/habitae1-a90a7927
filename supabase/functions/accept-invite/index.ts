import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = { id: authUser.id, email: authUser.email! };

    const { invite_id } = await req.json();
    if (!invite_id) {
      return new Response(JSON.stringify({ error: "invite_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email binding on the invite
    const { data: inviteData } = await adminClient
      .from("organization_invites")
      .select("email")
      .eq("id", invite_id)
      .single();

    if (inviteData?.email && inviteData.email.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
      return new Response(JSON.stringify({ error: "Este convite é destinado a outro email" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call atomic RPC
    const { data, error } = await adminClient.rpc("accept_organization_invite", {
      p_invite_id: invite_id,
      p_user_id: user.id,
      p_user_email: user.email,
    });

    if (error) {
      console.error("[accept-invite] RPC error:", error.message);
      return new Response(JSON.stringify({ error: "Erro interno" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = data as { success?: boolean; error?: string; status?: number; message?: string };

    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status || 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, message: result.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[accept-invite] Error:", (error as Error).message);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

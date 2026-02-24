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

    const { invite_id, email, password, full_name, company_name, phone, account_type } = await req.json();

    if (!invite_id || !email || !password || !full_name || !company_name) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate invite
    const { data: invite, error: inviteError } = await adminClient
      .from("platform_invites")
      .select("*")
      .eq("id", invite_id)
      .single();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: "Convite não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.status !== "active") {
      return new Response(JSON.stringify({ error: "Convite já utilizado ou expirado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(invite.expires_at) < new Date()) {
      await adminClient.from("platform_invites").update({ status: "expired" }).eq("id", invite_id);
      return new Response(JSON.stringify({ error: "Convite expirado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // A08: Validate email binding — if invite has invite_email, it must match
    if (invite.invite_email) {
      if (invite.invite_email.toLowerCase().trim() !== email.toLowerCase().trim()) {
        console.error("[platform-signup] Email mismatch for invite");
        return new Response(JSON.stringify({ error: "Este convite é destinado a outro e-mail" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Create the auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone: phone || null,
        account_type: account_type || "imobiliaria",
        company_name,
      },
    });

    if (authError) {
      const msg = authError.message.includes("already been registered")
        ? "Este email já está cadastrado. Faça login."
        : authError.message;
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const now = new Date();
    const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Create organization with trial
    const { data: org, error: orgError } = await adminClient
      .from("organizations")
      .insert({
        name: company_name,
        type: account_type || "imobiliaria",
        created_by: userId,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (orgError) {
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: "Erro ao criar organização" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update or create profile
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingProfile) {
      await adminClient
        .from("profiles")
        .update({
          organization_id: org.id,
          full_name,
          phone: phone || null,
          onboarding_completed: true,
          email_verified: true,
        })
        .eq("user_id", userId);
    } else {
      await adminClient
        .from("profiles")
        .insert({
          user_id: userId,
          organization_id: org.id,
          full_name,
          phone: phone || null,
          onboarding_completed: true,
          email_verified: true,
        });
    }

    // Assign admin role
    await adminClient.from("user_roles").delete().eq("user_id", userId);
    await adminClient.from("user_roles").insert({ user_id: userId, role: "admin" });

    // Mark invite as used (transactional)
    const { error: markError } = await adminClient
      .from("platform_invites")
      .update({
        status: "used",
        used_at: now.toISOString(),
        used_by_organization_id: org.id,
      })
      .eq("id", invite_id)
      .eq("status", "active"); // Prevent race condition

    if (markError) {
      console.error("[platform-signup] Failed to mark invite:", markError.message);
    }

    return new Response(JSON.stringify({ success: true, organization_id: org.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[platform-signup] Error");
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

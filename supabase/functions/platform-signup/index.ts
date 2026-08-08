import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_ORIGINS = (Deno.env.get("APP_ALLOWED_ORIGINS") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

function isAllowedOrigin(req: Request): boolean {
  if (ALLOWED_ORIGINS.length === 0) return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "unknown";

    const logRequest = async (statusCode: number, outcome: string, metadata: Record<string, unknown> = {}) => {
      await adminClient.rpc("log_public_function_request", {
        p_function_name: "platform-signup",
        p_status_code: statusCode,
        p_outcome: outcome,
        p_principal: clientIp,
        p_metadata: {
          ...metadata,
          user_agent: userAgent,
        },
      });
    };

    if (!isAllowedOrigin(req)) {
      await logRequest(403, "blocked_origin");
      return new Response(JSON.stringify({ error: "Origem não permitida" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ipQuota, error: ipQuotaError } = await adminClient.rpc("consume_public_function_rate_limit", {
      p_function_name: "platform-signup",
      p_principal: `ip:${clientIp}`,
      p_limit: 15,
      p_window_seconds: 300,
    });

    if (ipQuotaError || !ipQuota?.[0]?.allowed) {
      await logRequest(429, "rate_limited_ip", { quota_error: ipQuotaError?.message ?? null });
      return new Response(JSON.stringify({ error: "Muitas tentativas. Tente novamente em alguns minutos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { invite_id, email, password, full_name, company_name, phone, account_type, website } = await req.json();

    if (website) {
      await logRequest(400, "honeypot_triggered");
      return new Response(JSON.stringify({ error: "Requisição inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!invite_id || !email || !password || !full_name || !company_name) {
      await logRequest(400, "missing_required_fields");
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 8) {
      await logRequest(400, "weak_password");
      return new Response(JSON.stringify({ error: "Senha fraca. Use ao menos 8 caracteres." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inviteQuota, error: inviteQuotaError } = await adminClient.rpc("consume_public_function_rate_limit", {
      p_function_name: "platform-signup",
      p_principal: `invite:${invite_id}`,
      p_limit: 8,
      p_window_seconds: 900,
    });

    if (inviteQuotaError || !inviteQuota?.[0]?.allowed) {
      await logRequest(429, "rate_limited_invite", { invite_id });
      return new Response(JSON.stringify({ error: "Convite temporariamente bloqueado por excesso de tentativas." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate invite
    const { data: invite, error: inviteError } = await adminClient
      .from("platform_invites")
      .select("*")
      .eq("id", invite_id)
      .single();

    if (inviteError || !invite) {
      await logRequest(404, "invite_not_found", { invite_id });
      return new Response(JSON.stringify({ error: "Convite não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.status !== "active") {
      await logRequest(400, "invite_inactive", { invite_id, invite_status: invite.status });
      return new Response(JSON.stringify({ error: "Convite já utilizado ou expirado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(invite.expires_at) < new Date()) {
      await adminClient.from("platform_invites").update({ status: "expired" }).eq("id", invite_id);
      await logRequest(400, "invite_expired", { invite_id });
      return new Response(JSON.stringify({ error: "Convite expirado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // A08: Validate email binding — if invite has invite_email, it must match
    if (invite.invite_email) {
      if (invite.invite_email.toLowerCase().trim() !== email.toLowerCase().trim()) {
        console.error("[platform-signup] Email mismatch for invite");
        await logRequest(403, "invite_email_mismatch", { invite_id });
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
      await logRequest(400, "auth_create_user_failed", { reason: msg });
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
      await logRequest(500, "organization_creation_failed", { invite_id });
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

    await logRequest(200, "success", { invite_id, organization_id: org.id });

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

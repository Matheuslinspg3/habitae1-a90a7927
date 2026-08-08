import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  defaultRateLimitConfig,
  evaluateProtection,
  extractClientIp,
  isOriginAllowed,
  parseAllowedOrigins,
  summarizeAttempts,
} from "./security.ts";

const baseCorsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function corsHeadersFor(req: Request) {
  const runtimeEnv = Deno.env.get("SUPABASE_ENV") ?? Deno.env.get("DENO_ENV") ?? "production";
  const allowedOrigins = parseAllowedOrigins(
    Deno.env.get("PLATFORM_SIGNUP_ALLOWED_ORIGINS") ?? undefined,
    runtimeEnv,
  );
  const origin = req.headers.get("origin");

  if (!isOriginAllowed(origin, allowedOrigins)) {
    return { allowed: false, headers: baseCorsHeaders };
  }

  return {
    allowed: true,
    headers: {
      ...baseCorsHeaders,
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    },
  };
}

async function verifyChallengeToken(token: string) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    return false;
  }

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return payload.success === true;
  } catch (_error) {
    return false;
  }
}

serve(async (req) => {
  const cors = corsHeadersFor(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors.headers });
  }

  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: "Origem não autorizada" }), {
      status: 403,
      headers: { ...cors.headers, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  const ipAddress = extractClientIp(req);
  let inviteIdForAudit: string | null = null;

  async function logAttempt(
    outcome: "success" | "failure" | "blocked" | "challenge_required",
    context: Record<string, unknown> = {},
  ) {
    const { error } = await adminClient.from("platform_signup_attempts").insert({
      ip_address: ipAddress,
      invite_id: inviteIdForAudit,
      outcome,
      user_agent: req.headers.get("user-agent"),
      request_origin: req.headers.get("origin"),
      context,
    });

    if (error) {
      console.error("[platform-signup] Failed to persist audit attempt", error.message);
    }
  }

  async function maybeAlertAnomaly(
    type: "rate_limit" | "suspicious_pattern",
    metrics: Record<string, unknown>,
  ) {
    const { error } = await adminClient.from("platform_signup_security_alerts").insert({
      alert_type: type,
      severity: type === "rate_limit" ? "medium" : "high",
      ip_address: ipAddress,
      invite_id: inviteIdForAudit,
      metrics,
    });

    if (error) {
      console.error("[platform-signup] Failed to persist security alert", error.message);
    }

    console.warn("[platform-signup] Security anomaly detected", { type, ipAddress, inviteIdForAudit, metrics });
  }

  try {
    const { invite_id, email, password, full_name, company_name, phone, account_type, challenge_token } =
      await req.json();

    inviteIdForAudit = invite_id ?? null;

    if (!invite_id || !email || !password || !full_name || !company_name) {
      await logAttempt("failure", { reason: "missing_required_fields" });
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400,
        headers: { ...cors.headers, "Content-Type": "application/json" },
      });
    }

    const { data: attemptHistory, error: attemptHistoryError } = await adminClient
      .from("platform_signup_attempts")
      .select("created_at, ip_address, invite_id, outcome")
      .or(`ip_address.eq.${ipAddress},invite_id.eq.${invite_id}`)
      .gte("created_at", new Date(Date.now() - defaultRateLimitConfig.windowMs).toISOString())
      .order("created_at", { ascending: false })
      .limit(200);

    if (attemptHistoryError) {
      console.error("[platform-signup] Failed to load attempt history", attemptHistoryError.message);
    }

    const summary = summarizeAttempts(
      attemptHistory ?? [],
      invite_id,
      ipAddress,
      new Date(),
      defaultRateLimitConfig,
    );
    const protection = evaluateProtection(summary, defaultRateLimitConfig);

    if (protection.blockedByRateLimit) {
      await logAttempt("blocked", { reason: "rate_limited", summary });
      await maybeAlertAnomaly("rate_limit", summary);
      return new Response(JSON.stringify({ error: "Muitas tentativas. Tente novamente mais tarde." }), {
        status: 429,
        headers: { ...cors.headers, "Content-Type": "application/json" },
      });
    }

    if (protection.requiresChallenge) {
      const challengePassed = typeof challenge_token === "string" && await verifyChallengeToken(challenge_token);
      if (!challengePassed) {
        await logAttempt("challenge_required", { reason: "challenge_required", summary });
        return new Response(JSON.stringify({
          error: "Validação anti-automação obrigatória.",
          challenge_required: true,
        }), {
          status: 403,
          headers: { ...cors.headers, "Content-Type": "application/json" },
        });
      }
    }

    if (protection.anomalyDetected) {
      await maybeAlertAnomaly("suspicious_pattern", summary);
    }

    // Validate invite
    const { data: invite, error: inviteError } = await adminClient
      .from("platform_invites")
      .select("*")
      .eq("id", invite_id)
      .single();

    if (inviteError || !invite) {
      await logAttempt("failure", { reason: "invite_not_found" });
      return new Response(JSON.stringify({ error: "Convite não encontrado" }), {
        status: 404,
        headers: { ...cors.headers, "Content-Type": "application/json" },
      });
    }

    if (invite.status !== "active") {
      await logAttempt("failure", { reason: "invite_not_active", invite_status: invite.status });
      return new Response(JSON.stringify({ error: "Convite já utilizado ou expirado" }), {
        status: 400,
        headers: { ...cors.headers, "Content-Type": "application/json" },
      });
    }

    if (new Date(invite.expires_at) < new Date()) {
      await adminClient.from("platform_invites").update({ status: "expired" }).eq("id", invite_id);
      await logAttempt("failure", { reason: "invite_expired" });
      return new Response(JSON.stringify({ error: "Convite expirado" }), {
        status: 400,
        headers: { ...cors.headers, "Content-Type": "application/json" },
      });
    }

    // A08: Validate email binding — if invite has invite_email, it must match
    if (invite.invite_email) {
      if (invite.invite_email.toLowerCase().trim() !== email.toLowerCase().trim()) {
        await logAttempt("failure", { reason: "invite_email_mismatch" });
        console.error("[platform-signup] Email mismatch for invite");
        return new Response(JSON.stringify({ error: "Este convite é destinado a outro e-mail" }), {
          status: 403,
          headers: { ...cors.headers, "Content-Type": "application/json" },
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
      await logAttempt("failure", { reason: "auth_create_error", message: authError.message });
      const msg = authError.message.includes("already been registered")
        ? "Este email já está cadastrado. Faça login."
        : authError.message;
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...cors.headers, "Content-Type": "application/json" },
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
      await logAttempt("failure", { reason: "organization_create_error", message: orgError.message });
      return new Response(JSON.stringify({ error: "Erro ao criar organização" }), {
        status: 500,
        headers: { ...cors.headers, "Content-Type": "application/json" },
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

    await logAttempt("success", { organization_id: org.id, user_id: userId });

    return new Response(JSON.stringify({ success: true, organization_id: org.id }), {
      status: 200,
      headers: { ...cors.headers, "Content-Type": "application/json" },
    });
  } catch (error) {
    await logAttempt("failure", { reason: "internal_error" });
    console.error("[platform-signup] Error", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...cors.headers, "Content-Type": "application/json" },
    });
  }
});

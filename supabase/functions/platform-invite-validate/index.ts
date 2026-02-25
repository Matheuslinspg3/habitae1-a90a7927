import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_ATTEMPTS = 20;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getIpAddress = (req: Request): string | null => {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.headers.get("cf-connecting-ip") ?? null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  const ipAddress = getIpAddress(req);
  const userAgent = req.headers.get("user-agent");

  const logAttempt = async ({
    inviteIdText,
    inviteId,
    success,
    failureReason,
  }: {
    inviteIdText: string;
    inviteId: string | null;
    success: boolean;
    failureReason: string | null;
  }) => {
    const { error } = await adminClient.from("platform_invite_validation_attempts").insert({
      invite_id_text: inviteIdText,
      invite_id: inviteId,
      ip_address: ipAddress,
      user_agent: userAgent,
      success,
      failure_reason: failureReason,
    });

    if (error) {
      console.error("[platform-invite-validate] Failed to audit attempt:", error.message);
    }
  };

  try {
    const body = await req.json();
    const inviteIdText = typeof body?.invite_id === "string" ? body.invite_id.trim() : "";

    if (!inviteIdText) {
      await logAttempt({
        inviteIdText: "",
        inviteId: null,
        success: false,
        failureReason: "missing_invite_id",
      });

      return new Response(JSON.stringify({ error: "invite_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ipAddress) {
      const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

      const { count, error: rateLimitError } = await adminClient
        .from("platform_invite_validation_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ipAddress)
        .gte("created_at", windowStart);

      if (rateLimitError) {
        console.error("[platform-invite-validate] Rate limit check failed:", rateLimitError.message);
      }

      if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
        await logAttempt({
          inviteIdText,
          inviteId: UUID_REGEX.test(inviteIdText) ? inviteIdText : null,
          success: false,
          failureReason: "rate_limited",
        });

        return new Response(JSON.stringify({ error: "Muitas tentativas. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!UUID_REGEX.test(inviteIdText)) {
      await logAttempt({
        inviteIdText,
        inviteId: null,
        success: false,
        failureReason: "invalid_invite_id_format",
      });

      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invite, error: inviteError } = await adminClient
      .from("platform_invites")
      .select("id, name, invite_email, status, expires_at")
      .eq("id", inviteIdText)
      .maybeSingle();

    if (inviteError || !invite) {
      await logAttempt({
        inviteIdText,
        inviteId: inviteIdText,
        success: false,
        failureReason: "not_found",
      });

      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.status !== "active") {
      await logAttempt({
        inviteIdText,
        inviteId: inviteIdText,
        success: false,
        failureReason: "inactive",
      });

      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(invite.expires_at) < new Date()) {
      await adminClient.from("platform_invites").update({ status: "expired" }).eq("id", inviteIdText);

      await logAttempt({
        inviteIdText,
        inviteId: inviteIdText,
        success: false,
        failureReason: "expired",
      });

      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logAttempt({
      inviteIdText,
      inviteId: inviteIdText,
      success: true,
      failureReason: null,
    });

    return new Response(
      JSON.stringify({
        valid: true,
        invite: {
          name: invite.name,
          invite_email: invite.invite_email,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[platform-invite-validate] Error:", (error as Error).message);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

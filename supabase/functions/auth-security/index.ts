import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CAPTCHA_THRESHOLD_SESSION = 3;
const CAPTCHA_THRESHOLD_IP = 5;
const LOCKOUT_THRESHOLD_SESSION = 7;
const LOCKOUT_THRESHOLD_IP = 10;
const WINDOW_MINUTES = 15;
const LOCKOUT_MINUTES = 15;

function getIpFromRequest(req: Request): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return req.headers.get("x-real-ip");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const logger = createLogger("auth-security", req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRole);

    const ipAddress = getIpFromRequest(req);
    const body = await req.json();
    const action = body?.action as string;
    const sessionId = (body?.sessionId as string | undefined)?.trim() || null;
    const email = (body?.email as string | undefined)?.trim().toLowerCase() || null;

    if (!action) {
      return new Response(JSON.stringify({ error: "Action is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

    const [sessionResult, ipResult] = await Promise.all([
      sessionId
        ? supabase
            .from("auth_login_attempts")
            .select("id", { count: "exact", head: true })
            .eq("success", false)
            .eq("session_id", sessionId)
            .gte("created_at", windowStart)
        : Promise.resolve({ count: 0, error: null } as any),
      ipAddress
        ? supabase
            .from("auth_login_attempts")
            .select("id", { count: "exact", head: true })
            .eq("success", false)
            .eq("ip_address", ipAddress)
            .gte("created_at", windowStart)
        : Promise.resolve({ count: 0, error: null } as any),
    ]);

    if (sessionResult.error || ipResult.error) {
      logger.error("failed_to_count_attempts", {
        session_error: sessionResult.error?.message,
        ip_error: ipResult.error?.message,
      });

      return new Response(JSON.stringify({ error: "Failed to evaluate auth status" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const failedAttemptsSession = sessionResult.count ?? 0;
    const failedAttemptsIpWindow = ipResult.count ?? 0;

    let lockoutUntil: string | null = null;
    if (
      failedAttemptsSession >= LOCKOUT_THRESHOLD_SESSION ||
      failedAttemptsIpWindow >= LOCKOUT_THRESHOLD_IP
    ) {
      lockoutUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString();
    }

    if (action === "record_attempt") {
      const success = Boolean(body?.success);
      const reason = (body?.reason as string | undefined)?.trim() || "unknown";

      const { error: insertError } = await supabase.from("auth_login_attempts").insert({
        email,
        session_id: sessionId,
        ip_address: ipAddress,
        success,
        reason,
        metadata: {
          user_agent: req.headers.get("user-agent"),
        },
      });

      if (insertError) {
        logger.error("failed_to_record_attempt", { message: insertError.message, reason });
      }

      if (!success && (failedAttemptsIpWindow >= LOCKOUT_THRESHOLD_IP || failedAttemptsSession >= LOCKOUT_THRESHOLD_SESSION)) {
        logger.warn("auth_anomaly_detected", {
          failedAttemptsSession,
          failedAttemptsIpWindow,
          captcha_threshold_session: CAPTCHA_THRESHOLD_SESSION,
          captcha_threshold_ip: CAPTCHA_THRESHOLD_IP,
        });
      }
    }

    return new Response(
      JSON.stringify({
        failedAttemptsSession,
        failedAttemptsIpWindow,
        lockoutUntil,
        policy: {
          captchaThresholdSession: CAPTCHA_THRESHOLD_SESSION,
          captchaThresholdIp: CAPTCHA_THRESHOLD_IP,
          lockoutThresholdSession: LOCKOUT_THRESHOLD_SESSION,
          lockoutThresholdIp: LOCKOUT_THRESHOLD_IP,
          lockoutWindowMinutes: WINDOW_MINUTES,
          lockoutDurationMinutes: LOCKOUT_MINUTES,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    logger.error("auth_security_error", {
      error: error instanceof Error ? error.message : "unknown_error",
    });

    return new Response(JSON.stringify({ error: "Unexpected auth security error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

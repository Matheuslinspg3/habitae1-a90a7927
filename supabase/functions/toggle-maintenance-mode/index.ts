import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { NotificationService } from "../_shared/notification-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function purgeCloudflareCache(): Promise<{ success: boolean; error?: string }> {
  const zoneId = Deno.env.get("CLOUDFLARE_ZONE_ID");
  const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");

  if (!zoneId || !apiToken) {
    return { success: false, error: "Cloudflare credentials not configured" };
  }

  try {
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purge_everything: true }),
      }
    );
    const cfData = await cfResponse.json();
    return cfData.success ? { success: true } : { success: false, error: JSON.stringify(cfData.errors) };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate JWT
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Use service_role to check admin and perform mutations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user is system admin
    const { data: isAdmin } = await supabaseAdmin.rpc("is_system_admin").setHeader("Authorization", authHeader);

    // Fallback: check admin_allowlist directly
    let adminAllowed = isAdmin === true;
    if (!adminAllowed) {
      const userEmail = claimsData.claims.email as string;
      const { data: allowlistRow } = await supabaseAdmin
        .from("admin_allowlist")
        .select("id")
        .ilike("email", userEmail)
        .maybeSingle();
      adminAllowed = !!allowlistRow;
    }

    if (!adminAllowed) {
      return new Response(JSON.stringify({ error: "Forbidden: not a system admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action as "activate" | "deactivate";
    const message = body.message as string | undefined;
    const autoPurgeCache = body.auto_purge_cache !== false; // default true
    const sendPushNotification = body.send_push === true;
    const pushTitle = body.push_title as string | undefined;
    const pushMessage = body.push_message as string | undefined;

    if (!action || !["activate", "deactivate"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current state
    const { data: currentConfig } = await supabaseAdmin
      .from("app_runtime_config")
      .select("*")
      .eq("id", "singleton")
      .single();

    const previousValue = currentConfig?.maintenance_mode ?? false;
    const newValue = action === "activate";

    // Update config
    const updatePayload: Record<string, unknown> = {
      maintenance_mode: newValue,
      updated_at: new Date().toISOString(),
    };

    if (action === "activate") {
      updatePayload.maintenance_started_at = new Date().toISOString();
      updatePayload.maintenance_started_by = userId;
      if (message) updatePayload.maintenance_message = message;
    } else {
      updatePayload.maintenance_started_at = null;
      updatePayload.maintenance_started_by = null;
    }

    if (message !== undefined) {
      updatePayload.maintenance_message = message || currentConfig?.maintenance_message;
    }

    const { error: updateError } = await supabaseAdmin
      .from("app_runtime_config")
      .update(updatePayload)
      .eq("id", "singleton");

    if (updateError) throw updateError;

    // Insert audit log
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    await supabaseAdmin.from("maintenance_audit_log").insert({
      action: action,
      performed_by: userId,
      previous_value: previousValue,
      new_value: newValue,
      maintenance_message: message || currentConfig?.maintenance_message,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // Auto-purge Cloudflare cache on activation to force clients to fetch fresh resources
    let cachePurgeResult = null;
    if (autoPurgeCache) {
      cachePurgeResult = await purgeCloudflareCache();
    }

    // Return final state
    const { data: finalConfig } = await supabaseAdmin
      .from("app_runtime_config")
      .select("*")
      .eq("id", "singleton")
      .single();

    return new Response(JSON.stringify({
      success: true,
      config: finalConfig,
      cache_purge: cachePurgeResult,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

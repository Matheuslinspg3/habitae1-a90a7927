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
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("RD Station OAuth error:", error);
      return redirectToApp("?rd_error=" + encodeURIComponent(error));
    }

    if (!code || !state) {
      return redirectToApp("?rd_error=missing_params");
    }

    let stateData: { org_id: string; origin?: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return redirectToApp("?rd_error=invalid_state");
    }

    const clientId = Deno.env.get("RD_STATION_CLIENT_ID");
    const clientSecret = Deno.env.get("RD_STATION_CLIENT_SECRET");
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/rd-station-oauth-callback`;

    if (!clientId || !clientSecret) {
      console.error("RD_STATION_CLIENT_ID or RD_STATION_CLIENT_SECRET not configured");
      return redirectToApp("?rd_error=server_config", stateData.origin);
    }

    // Exchange code for tokens
    console.log("Exchanging code for tokens...");
    const tokenRes = await fetch("https://api.rd.services/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error("Token exchange error:", JSON.stringify(tokenData));
      return redirectToApp("?rd_error=token_exchange", stateData.origin);
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token) {
      console.error("No access_token in response:", JSON.stringify(tokenData));
      return redirectToApp("?rd_error=token_exchange", stateData.origin);
    }

    console.log("Token exchange OK, saving to database...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const expiresAt = new Date(Date.now() + (expires_in || 86400) * 1000).toISOString();

    const { error: dbError } = await supabase
      .from("rd_station_settings")
      .update({
        oauth_access_token: access_token,
        oauth_refresh_token: refresh_token || null,
        oauth_token_expires_at: expiresAt,
        oauth_client_id: clientId,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", stateData.org_id);

    if (dbError) {
      console.error("DB save error:", dbError);
      return redirectToApp("?rd_error=db_save", stateData.origin);
    }

    console.log("OAuth tokens saved successfully for org:", stateData.org_id);
    return redirectToApp("?rd_success=true", stateData.origin);
  } catch (err) {
    console.error("Unexpected error:", err);
    return redirectToApp("?rd_error=unexpected");
  }
});

function redirectToApp(params: string, origin?: string) {
  const appUrl = origin || Deno.env.get("APP_URL") || "https://habitae1.lovable.app";
  const target = `${appUrl}/rdstation?tab=config${params}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      ...corsHeaders,
    },
  });
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // contains user_id + org_id
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Meta OAuth error:", error, url.searchParams.get("error_description"));
      return redirectToApp("?meta_error=" + encodeURIComponent(error));
    }

    if (!code || !state) {
      return redirectToApp("?meta_error=missing_params");
    }

    // Decode state
    let stateData: { user_id: string; org_id: string; redirect: string };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return redirectToApp("?meta_error=invalid_state");
    }

    const appId = Deno.env.get("META_APP_ID");
    const appSecret = Deno.env.get("META_APP_SECRET");
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-oauth-callback`;

    if (!appId || !appSecret) {
      console.error("META_APP_ID or META_APP_SECRET not configured");
      return redirectToApp("?meta_error=server_config");
    }

    // Exchange code for access token
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Token exchange error:", tokenData.error);
      return redirectToApp("?meta_error=token_exchange");
    }

    const accessToken = tokenData.access_token;

    // Exchange for long-lived token
    const longLivedUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", appId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", accessToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();

    const finalToken = longLivedData.access_token || accessToken;

    // Fetch ad accounts
    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&access_token=${finalToken}`
    );
    const adAccountsData = await adAccountsRes.json();

    const adAccounts = adAccountsData.data || [];
    const firstAccount = adAccounts.find((a: any) => a.account_status === 1) || adAccounts[0];

    if (!firstAccount) {
      return redirectToApp("?meta_error=no_ad_account");
    }

    // Save to database using service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: dbError } = await supabase
      .from("ad_accounts")
      .upsert(
        {
          organization_id: stateData.org_id,
          provider: "meta",
          external_account_id: firstAccount.id,
          name: firstAccount.name || `Meta Ads - ${firstAccount.id}`,
          is_active: true,
          auth_payload: {
            access_token: finalToken,
            token_type: longLivedData.token_type || "bearer",
            expires_in: longLivedData.expires_in,
            obtained_at: new Date().toISOString(),
            ad_accounts: adAccounts.map((a: any) => ({ id: a.id, name: a.name })),
          },
          status: "connected",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,provider" }
      );

    if (dbError) {
      console.error("DB save error:", dbError);
      return redirectToApp("?meta_error=db_save");
    }

    return redirectToApp("?meta_success=true");
  } catch (err) {
    console.error("Unexpected error:", err);
    return redirectToApp("?meta_error=unexpected");
  }
});

function redirectToApp(params: string) {
  // Redirect back to the app's settings page
  const appUrl = Deno.env.get("APP_URL") || "https://habitae1.lovable.app";
  const target = `${appUrl}/anuncios?tab=configuracoes${params}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      ...corsHeaders,
    },
  });
}

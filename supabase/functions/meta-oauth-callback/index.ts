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
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorReason = url.searchParams.get("error_reason");
    const errorDescription = url.searchParams.get("error_description");

    console.log("OAuth callback received:", { hasCode: !!code, hasState: !!state, error, errorReason, errorDescription });

    if (error) {
      console.error("Meta OAuth error:", { error, errorReason, errorDescription });
      return redirectToApp("?meta_error=" + encodeURIComponent(error));
    }

    if (!code || !state) {
      return redirectToApp("?meta_error=missing_params");
    }

    let stateData: { user_id: string; org_id: string; redirect: string; origin?: string };
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
      return redirectToApp("?meta_error=server_config", stateData.origin);
    }

    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Token exchange error:", JSON.stringify(tokenData.error));
      return redirectToApp("?meta_error=token_exchange", stateData.origin);
    }

    if (!tokenData.access_token) {
      console.error("No access_token in response:", JSON.stringify(tokenData));
      return redirectToApp("?meta_error=token_exchange", stateData.origin);
    }

    const accessToken = tokenData.access_token;
    console.log("Token exchange OK, exchanging for long-lived token...");

    const longLivedUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", appId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", accessToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json();

    const finalToken = longLivedData.access_token || accessToken;

    console.log("Fetching ad accounts...");
    const adAccountsRes = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&access_token=${finalToken}`
    );
    const adAccountsData = await adAccountsRes.json();

    if (adAccountsData.error) {
      console.error("Ad accounts fetch error:", JSON.stringify(adAccountsData.error));
      const isMissingPermissions = adAccountsData.error?.code === 200 &&
        String(adAccountsData.error?.message || "").toLowerCase().includes("missing permissions");
      return redirectToApp(
        `?meta_error=${isMissingPermissions ? "missing_permissions" : "no_ad_account"}`,
        stateData.origin,
      );
    }

    const adAccounts = adAccountsData.data || [];
    console.log(`Found ${adAccounts.length} ad accounts:`, adAccounts.map((a: any) => ({ id: a.id, name: a.name, status: a.account_status })));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: organization } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", stateData.org_id)
      .maybeSingle();

    const selectedAccount = selectBestAdAccount(adAccounts, organization?.name);

    if (!selectedAccount) {
      console.error("No ad account found for user. Total accounts:", adAccounts.length);
      return redirectToApp("?meta_error=no_ad_account", stateData.origin);
    }
    console.log("Selected ad account:", selectedAccount.id, selectedAccount.name);

    const { error: dbError } = await supabase
      .from("ad_accounts")
      .upsert(
        {
          organization_id: stateData.org_id,
          provider: "meta",
          external_account_id: selectedAccount.id,
          name: selectedAccount.name || `Meta Ads - ${selectedAccount.id}`,
          is_active: true,
          auth_payload: {
            access_token: finalToken,
            token_type: longLivedData.token_type || "bearer",
            expires_in: longLivedData.expires_in,
            obtained_at: new Date().toISOString(),
            ad_accounts: adAccounts.map((a: any) => ({ id: a.id, name: a.name, status: a.account_status })),
          },
          status: "connected",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,provider" }
      );

    if (dbError) {
      console.error("DB save error:", dbError);
      return redirectToApp("?meta_error=db_save", stateData.origin);
    }

    return redirectToApp("?meta_success=true", stateData.origin);
  } catch (err) {
    console.error("Unexpected error:", err);
    return redirectToApp("?meta_error=unexpected");
  }
});

function normalizeName(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function selectBestAdAccount(
  adAccounts: Array<{ id: string; name?: string | null; account_status?: number }>,
  organizationName?: string | null,
) {
  if (!adAccounts.length) return null;

  const activeAccounts = adAccounts.filter((account) => account.account_status === 1);
  const candidates = activeAccounts.length ? activeAccounts : adAccounts;
  const normalizedOrgName = normalizeName(organizationName);

  if (normalizedOrgName) {
    const directMatch = candidates.find((account) => {
      const normalizedAccountName = normalizeName(account.name);
      return normalizedAccountName.includes(normalizedOrgName) || normalizedOrgName.includes(normalizedAccountName);
    });

    if (directMatch) return directMatch;

    const orgTokens = normalizedOrgName.match(/[a-z0-9]+/g) || [];
    const tokenMatch = candidates.find((account) => {
      const normalizedAccountName = normalizeName(account.name);
      return orgTokens.filter((token) => token.length >= 4).some((token) => normalizedAccountName.includes(token));
    });

    if (tokenMatch) return tokenMatch;
  }

  return candidates[0];
}

function redirectToApp(params: string, origin?: string) {
  const appUrl = origin || Deno.env.get("APP_URL") || "https://habitae1.lovable.app";
  const target = `${appUrl}/anuncios?tab=configuracoes${params}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      ...corsHeaders,
    },
  });
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PushPayload {
  user_id: string;
  title: string;
  message: string;
  entity_id?: string;
  entity_type?: string;
  notification_type?: string;
}

interface FcmErrorMetadata {
  httpCode?: number;
  status?: string;
  message?: string;
  detailErrorCodes: string[];
  detailStatuses: string[];
}

/** Get an OAuth2 access token for FCM v1 API using service account */
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  const encode = (obj: any) => {
    const json = new TextEncoder().encode(JSON.stringify(obj));
    return btoa(String.fromCharCode(...json))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };

  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signedToken = `${unsignedToken}.${btoa(
    String.fromCharCode(...new Uint8Array(signature))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedToken}`,
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// --- FCM error helpers ---
function getFcmErrorMetadata(errData: any): FcmErrorMetadata {
  const details = Array.isArray(errData?.error?.details) ? errData.error.details : [];
  return {
    httpCode: typeof errData?.error?.code === "number" ? errData.error.code : undefined,
    status: typeof errData?.error?.status === "string" ? errData.error.status : undefined,
    message: typeof errData?.error?.message === "string" ? errData.error.message : undefined,
    detailErrorCodes: details
      .map((d: any) => d?.errorCode)
      .filter((c: unknown): c is string => typeof c === "string"),
    detailStatuses: details
      .map((d: any) => d?.status)
      .filter((s: unknown): s is string => typeof s === "string"),
  };
}

function isStaleTokenError(errData: any): boolean {
  const meta = getFcmErrorMetadata(errData);
  const stale = new Set(["UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"]);
  if (meta.httpCode === 404) return true;
  if (meta.status && stale.has(meta.status)) return true;
  if (meta.detailErrorCodes.some((c) => stale.has(c))) return true;
  if (meta.detailStatuses.some((s) => stale.has(s))) return true;
  return false;
}

function getRequiredAppUrl(): string {
  const appUrl = Deno.env.get("APP_URL")?.trim();
  if (!appUrl) {
    throw new Error(
      "APP_URL environment variable is required for send-push (ex: https://habitae1.lovable.app)"
    );
  }
  let parsed: URL;
  try { parsed = new URL(appUrl); } catch {
    throw new Error(`APP_URL is invalid: ${appUrl}`);
  }
  return parsed.origin;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APP_URL = getRequiredAppUrl();
    const body: PushPayload = await req.json();
    const { user_id, title, message, entity_id, entity_type, notification_type } = body;

    if (!user_id || !title) {
      return new Response(
        JSON.stringify({ error: "user_id and title are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccountRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountRaw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY not configured");
    }
    const serviceAccount = JSON.parse(serviceAccountRaw);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("fcm_token")
      .eq("user_id", user_id);

    if (subError) {
      throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No push subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    const notificationData: Record<string, string> = {};
    if (entity_id) notificationData.entity_id = entity_id;
    if (entity_type) notificationData.entity_type = entity_type;
    if (notification_type) notificationData.notification_type = notification_type;

    let sent = 0;
    let failed = 0;
    const staleTokens: string[] = [];

    for (const sub of subscriptions) {
      try {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: sub.fcm_token,
                notification: {
                  title,
                  body: message || "",
                },
                webpush: {
                  notification: {
                    icon: `${APP_URL}/pwa-192x192.png`,
                    badge: `${APP_URL}/pwa-192x192.png`,
                    vibrate: [200, 100, 200],
                    tag: notification_type || "default",
                    renotify: true,
                    data: {
                      ...notificationData,
                      title,
                      message: message || "",
                    },
                  },
                  fcm_options: {
                    link: entity_type && entity_id
                      ? `${APP_URL}${getEntityLink(entity_type, entity_id)}`
                      : `${APP_URL}/dashboard`,
                  },
                },
                data: {
                  ...notificationData,
                  title,
                  message: message || "",
                },
              },
            }),
          }
        );

        if (res.ok) {
          sent++;
          const okData = await res.json();
          console.log("FCM send success:", JSON.stringify(okData));
        } else {
          failed++;
          const errData = await res.json();

          if (isStaleTokenError(errData)) {
            staleTokens.push(sub.fcm_token);
          }

          console.error(
            "FCM send error audit:",
            JSON.stringify({
              token: sub.fcm_token,
              staleTokenCandidate: isStaleTokenError(errData),
              ...getFcmErrorMetadata(errData),
            })
          );
        }
      } catch (e) {
        failed++;
        console.error("Error sending to token:", e);
      }
    }

    // Clean up stale tokens
    if (staleTokens.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("fcm_token", staleTokens);
    }

    return new Response(
      JSON.stringify({ sent, failed, staleRemoved: staleTokens.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-push error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getEntityLink(entityType: string, entityId: string): string {
  switch (entityType) {
    case "lead":
      return `/crm?lead=${entityId}`;
    case "property":
      return `/imoveis/${entityId}`;
    case "contract":
      return `/contratos?id=${entityId}`;
    case "appointment":
      return `/agenda?id=${entityId}`;
    default:
      return "/dashboard";
  }
}

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PushPayload = await req.json();
    const { user_id, title, message, entity_id, entity_type, notification_type } = body;

    if (!user_id || !title) {
      return new Response(
        JSON.stringify({ error: "user_id and title are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
    const APP_URL = Deno.env.get("APP_URL")?.trim() || "https://habitae1.lovable.app";

    if (!ONESIGNAL_APP_ID) {
      throw new Error("ONESIGNAL_APP_ID not configured");
    }
    if (!ONESIGNAL_REST_API_KEY) {
      throw new Error("ONESIGNAL_REST_API_KEY not configured");
    }

    const webUrl = entity_type && entity_id
      ? `${APP_URL}${getEntityLink(entity_type, entity_id)}`
      : `${APP_URL}/dashboard`;

    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_aliases: { external_id: [user_id] },
        target_channel: "push",
        headings: { en: title },
        contents: { en: message || title },
        ttl: 604800, // 7 days in seconds
        data: {
          entity_id: entity_id || "",
          entity_type: entity_type || "",
          notification_type: notification_type || "",
        },
        web_url: webUrl,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("OneSignal API error:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ sent: 0, error: data.errors || data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("OneSignal send success:", JSON.stringify(data));
    return new Response(
      JSON.stringify({ sent: data.recipients || 0, id: data.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-push error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

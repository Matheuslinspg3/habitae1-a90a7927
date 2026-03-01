import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { NotificationService } from "../_shared/notification-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PushPayload {
  user_id: string;
  title: string;
  message?: string;
  entity_id?: string;
  entity_type?: string;
  notification_type?: string;
}

function getEntityLink(entityType?: string, entityId?: string): string {
  if (!entityType || !entityId) return "/dashboard";

  switch (entityType) {
    case "lead":
      return `/crm?lead=${entityId}`;
    case "property":
      return `/imoveis/${entityId}`;
    case "appointment":
      return `/agenda?appointment=${entityId}`;
    default:
      return "/dashboard";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authentication: require service-role key OR valid user JWT ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      // Validate as user JWT
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body: PushPayload = await req.json();
    const { user_id, title, message, entity_id, entity_type, notification_type } = body;

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "user_id and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const APP_URL = Deno.env.get("APP_URL")?.trim() || "https://habitae1.lovable.app";
    const webUrl = entity_type && entity_id
      ? `${APP_URL}${getEntityLink(entity_type, entity_id)}`
      : `${APP_URL}/dashboard`;

    const service = new NotificationService(req);
    const result = await service.sendToUser(user_id, title, message || title, {
      entity_id: entity_id || "",
      entity_type: entity_type || "",
      notification_type: notification_type || "",
      web_url: webUrl,
    });

    if (!result.ok) {
      return new Response(JSON.stringify(result), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        sent: result.recipientsCount,
        id: result.notificationId,
        user_id,
        provider: "onesignal",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

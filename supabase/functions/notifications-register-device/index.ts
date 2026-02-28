import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { NotificationService } from "../_shared/notification-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, errorMessage: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ ok: false, errorMessage: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { onesignalId, platform, metadata, action } = await req.json();

    if (!onesignalId || !platform) {
      return new Response(JSON.stringify({ ok: false, errorMessage: "onesignalId and platform are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = new NotificationService(req);

    if (action === "unregister") {
      await service.unregisterDevice(user.id, onesignalId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await service.registerDevice({
      userId: user.id,
      onesignalId,
      platform,
      metadata: metadata || {},
    });

    return new Response(JSON.stringify({ ok: true, provider: "onesignal" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, provider: "onesignal", errorMessage: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

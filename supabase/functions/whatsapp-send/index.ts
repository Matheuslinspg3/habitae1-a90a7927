import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const UAZAPI_BASE_URL = Deno.env.get("UAZAPI_BASE_URL");
    if (!UAZAPI_BASE_URL) throw new Error("UAZAPI_BASE_URL not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.organization_id) throw new Error("No organization found");

    // Get instance token
    const { data: instance } = await supabaseClient
      .from("whatsapp_instances")
      .select("instance_token, status")
      .eq("organization_id", profile.organization_id)
      .single();

    if (!instance?.instance_token) throw new Error("WhatsApp não configurado para esta organização");
    if (instance.status !== "connected") throw new Error("WhatsApp desconectado");

    const body = await req.json();
    const { phone, message, type = "text" } = body;

    if (!phone || !message) throw new Error("phone and message are required");

    // Normalize phone (remove non-digits, ensure country code)
    const cleanPhone = phone.replace(/\D/g, "");
    const baseUrl = UAZAPI_BASE_URL.replace(/\/$/, "");

    let endpoint = `${baseUrl}/api/sendMessage/text`;
    let payload: Record<string, any> = {
      phone: cleanPhone,
      message,
    };

    if (type === "media") {
      endpoint = `${baseUrl}/api/sendMessage/media`;
      payload = {
        phone: cleanPhone,
        caption: message,
        media: body.mediaUrl,
        type: body.mediaType || "image",
      };
    }

    const uazapiRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: instance.instance_token,
      },
      body: JSON.stringify(payload),
    });

    const uazapiData = await uazapiRes.json();

    if (!uazapiRes.ok) {
      throw new Error(`Uazapi send error [${uazapiRes.status}]: ${JSON.stringify(uazapiData)}`);
    }

    return new Response(JSON.stringify({ success: true, data: uazapiData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("whatsapp-send error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

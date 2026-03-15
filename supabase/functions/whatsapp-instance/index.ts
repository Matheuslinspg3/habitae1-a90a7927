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
    const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN");
    if (!UAZAPI_BASE_URL) throw new Error("UAZAPI_BASE_URL not configured");
    if (!UAZAPI_ADMIN_TOKEN) throw new Error("UAZAPI_ADMIN_TOKEN not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

    // Verify user
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    // Get user's org
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.organization_id) throw new Error("No organization found");

    const orgId = profile.organization_id;
    const body = await req.json();
    const { action } = body;

    const baseUrl = UAZAPI_BASE_URL.replace(/\/$/, "");

    if (action === "create") {
      // Check if instance already exists
      const { data: existing } = await supabaseClient
        .from("whatsapp_instances")
        .select("id")
        .eq("organization_id", orgId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "Organização já possui uma instância WhatsApp" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instanceName = body.name || `habitae-${orgId.substring(0, 8)}`;

      // Create instance on Uazapi
      const uazapiRes = await fetch(`${baseUrl}/api/createInstance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          admintoken: UAZAPI_ADMIN_TOKEN,
        },
        body: JSON.stringify({ name: instanceName }),
      });

      const uazapiData = await uazapiRes.json();
      if (!uazapiRes.ok) {
        throw new Error(`Uazapi error: ${JSON.stringify(uazapiData)}`);
      }

      const instanceToken = uazapiData.token || uazapiData.instance?.token;

      // Save to DB
      const { data: instance, error: insertError } = await supabaseClient
        .from("whatsapp_instances")
        .insert({
          organization_id: orgId,
          instance_name: instanceName,
          instance_token: instanceToken,
          status: "disconnected",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return new Response(JSON.stringify({ instance, uazapi: uazapiData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "connect") {
      // Get instance for this org
      const { data: instance } = await supabaseClient
        .from("whatsapp_instances")
        .select("*")
        .eq("organization_id", orgId)
        .single();

      if (!instance?.instance_token) throw new Error("Instância não encontrada");

      // Request QR code from Uazapi
      const uazapiRes = await fetch(`${baseUrl}/api/getQrCode`, {
        method: "GET",
        headers: { token: instance.instance_token },
      });

      const uazapiData = await uazapiRes.json();

      // Update status
      await supabaseClient
        .from("whatsapp_instances")
        .update({
          status: "connecting",
          qr_code: uazapiData.qrcode || uazapiData.qr || null,
        })
        .eq("id", instance.id);

      return new Response(JSON.stringify({ qr_code: uazapiData.qrcode || uazapiData.qr, status: "connecting" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const { data: instance } = await supabaseClient
        .from("whatsapp_instances")
        .select("*")
        .eq("organization_id", orgId)
        .single();

      if (!instance?.instance_token) throw new Error("Instância não encontrada");

      const uazapiRes = await fetch(`${baseUrl}/api/status`, {
        method: "GET",
        headers: { token: instance.instance_token },
      });

      const uazapiData = await uazapiRes.json();
      const newStatus = uazapiData.status === "connected" ? "connected" :
                        uazapiData.status === "connecting" ? "connecting" : "disconnected";

      const updatePayload: Record<string, any> = { status: newStatus };
      if (newStatus === "connected") {
        updatePayload.qr_code = null;
        updatePayload.phone_number = uazapiData.phone || uazapiData.phoneNumber || instance.phone_number;
      }

      await supabaseClient
        .from("whatsapp_instances")
        .update(updatePayload)
        .eq("id", instance.id);

      return new Response(JSON.stringify({ status: newStatus, phone: updatePayload.phone_number || instance.phone_number }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      const { data: instance } = await supabaseClient
        .from("whatsapp_instances")
        .select("*")
        .eq("organization_id", orgId)
        .single();

      if (!instance?.instance_token) throw new Error("Instância não encontrada");

      await fetch(`${baseUrl}/api/disconnect`, {
        method: "POST",
        headers: { token: instance.instance_token },
      });

      await supabaseClient
        .from("whatsapp_instances")
        .update({ status: "disconnected", qr_code: null })
        .eq("id", instance.id);

      return new Response(JSON.stringify({ status: "disconnected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { data: instance } = await supabaseClient
        .from("whatsapp_instances")
        .select("*")
        .eq("organization_id", orgId)
        .single();

      if (!instance) throw new Error("Instância não encontrada");

      // Delete on Uazapi
      if (instance.instance_token) {
        try {
          await fetch(`${baseUrl}/api/deleteInstance`, {
            method: "DELETE",
            headers: { admintoken: UAZAPI_ADMIN_TOKEN, token: instance.instance_token },
          });
        } catch (e) {
          console.warn("Failed to delete on Uazapi:", e);
        }
      }

      await supabaseClient
        .from("whatsapp_instances")
        .delete()
        .eq("id", instance.id);

      return new Response(JSON.stringify({ deleted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("whatsapp-instance error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

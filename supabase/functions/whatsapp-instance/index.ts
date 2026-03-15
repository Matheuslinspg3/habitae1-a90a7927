import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const asLowerText = (value: unknown) => String(value ?? "").toLowerCase();

const pickFirstString = (candidates: unknown[]): string | null => {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();

    if (candidate && typeof candidate === "object") {
      const nested = candidate as Record<string, unknown>;
      const nestedValue = [nested.base64, nested.qrcode, nested.qr, nested.qrCode, nested.code, nested.value]
        .find((v) => typeof v === "string" && String(v).trim());

      if (typeof nestedValue === "string" && nestedValue.trim()) {
        return nestedValue.trim();
      }
    }
  }

  return null;
};

const extractQrCode = (payload: Record<string, any>) =>
  pickFirstString([
    payload?.qrcode,
    payload?.qr,
    payload?.qrCode,
    payload?.base64,
    payload?.data?.qrcode,
    payload?.data?.qr,
    payload?.data?.qrCode,
    payload?.data?.base64,
    payload?.data?.data?.qrcode,
    payload?.data?.data?.qr,
    payload?.data?.data?.base64,
  ]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // ── CREATE INSTANCE ──
    if (action === "create") {
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

      // Build instance name: orgName-userName-last4ofUserId
      const userIdSuffix = user.id.slice(-4);
      const sanitize = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 20);
      const orgName = sanitize(body.orgName || "org");
      const userName = sanitize(body.userName || "user");
      const instanceName = `${orgName}-${userName}-${userIdSuffix}`;

      // POST /instance/init  — header: admintoken
      const uazapiRes = await fetch(`${baseUrl}/instance/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          admintoken: UAZAPI_ADMIN_TOKEN,
        },
        body: JSON.stringify({ name: instanceName }),
      });

      const uazapiData = await uazapiRes.json();
      if (!uazapiRes.ok) {
        throw new Error(`Uazapi error [${uazapiRes.status}]: ${JSON.stringify(uazapiData)}`);
      }

      // The response contains the instance token
      const instanceToken = uazapiData.token || uazapiData.instance?.token || uazapiData.data?.token;

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

    // ── CONNECT (get QR code) ──
    if (action === "connect") {
      const { data: instance } = await supabaseClient
        .from("whatsapp_instances")
        .select("*")
        .eq("organization_id", orgId)
        .single();

      if (!instance?.instance_token) throw new Error("Instância não encontrada");

      // POST /instance/connect  — header: token
      const uazapiRes = await fetch(`${baseUrl}/instance/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: instance.instance_token,
        },
        body: JSON.stringify({}),
      });

      const uazapiData = await uazapiRes.json();
      if (!uazapiRes.ok) {
        throw new Error(`Uazapi connect error [${uazapiRes.status}]: ${JSON.stringify(uazapiData)}`);
      }

      const qrCode =
        uazapiData.qrcode ||
        uazapiData.qr ||
        uazapiData.base64 ||
        uazapiData.data?.qrcode ||
        uazapiData.data?.qr ||
        uazapiData.data?.base64 ||
        uazapiData.data?.qrCode ||
        null;

      await supabaseClient
        .from("whatsapp_instances")
        .update({ status: "connecting", qr_code: qrCode })
        .eq("id", instance.id);

      return new Response(JSON.stringify({ qr_code: qrCode, status: "connecting", raw: uazapiData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STATUS ──
    if (action === "status") {
      const { data: instance } = await supabaseClient
        .from("whatsapp_instances")
        .select("*")
        .eq("organization_id", orgId)
        .single();

      if (!instance?.instance_token) throw new Error("Instância não encontrada");

      // GET /instance/status  — header: token
      const uazapiRes = await fetch(`${baseUrl}/instance/status`, {
        method: "GET",
        headers: { token: instance.instance_token },
      });

      const uazapiData = await uazapiRes.json();
      if (!uazapiRes.ok) {
        throw new Error(`Uazapi status error [${uazapiRes.status}]: ${JSON.stringify(uazapiData)}`);
      }

      const rawStatus = String(uazapiData.status || uazapiData.state || uazapiData.data?.status || "").toLowerCase();
      const rawQr =
        uazapiData.qrcode ||
        uazapiData.qr ||
        uazapiData.base64 ||
        uazapiData.data?.qrcode ||
        uazapiData.data?.qr ||
        uazapiData.data?.base64 ||
        uazapiData.data?.qrCode ||
        null;

      const newStatus = rawStatus.includes("connect") && !rawStatus.includes("disconnect")
        ? "connected"
        : rawStatus.includes("connecting")
          ? "connecting"
          : "disconnected";

      const updatePayload: Record<string, any> = { status: newStatus };
      if (newStatus === "connected") {
        updatePayload.qr_code = null;
        updatePayload.phone_number = uazapiData.phone || uazapiData.phoneNumber || uazapiData.data?.phone || instance.phone_number;
      } else if (rawQr) {
        updatePayload.qr_code = rawQr;
      }

      await supabaseClient
        .from("whatsapp_instances")
        .update(updatePayload)
        .eq("id", instance.id);

      return new Response(JSON.stringify({ status: newStatus, phone: updatePayload.phone_number || instance.phone_number, qr_code: updatePayload.qr_code ?? instance.qr_code ?? null, raw: uazapiData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DISCONNECT ──
    if (action === "disconnect") {
      const { data: instance } = await supabaseClient
        .from("whatsapp_instances")
        .select("*")
        .eq("organization_id", orgId)
        .single();

      if (!instance?.instance_token) throw new Error("Instância não encontrada");

      // POST /instance/disconnect  — header: token
      const res = await fetch(`${baseUrl}/instance/disconnect`, {
        method: "POST",
        headers: { token: instance.instance_token },
      });
      await res.text(); // consume body

      await supabaseClient
        .from("whatsapp_instances")
        .update({ status: "disconnected", qr_code: null })
        .eq("id", instance.id);

      return new Response(JSON.stringify({ status: "disconnected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE ──
    if (action === "delete") {
      const { data: instance } = await supabaseClient
        .from("whatsapp_instances")
        .select("*")
        .eq("organization_id", orgId)
        .single();

      if (!instance) throw new Error("Instância não encontrada");

      // DELETE /instance  — header: token
      if (instance.instance_token) {
        try {
          const res = await fetch(`${baseUrl}/instance`, {
            method: "DELETE",
            headers: { token: instance.instance_token },
          });
          await res.text();
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

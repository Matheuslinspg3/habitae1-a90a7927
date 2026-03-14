import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { propertyId, imageUrl, config } = await req.json();
    if (!propertyId || !imageUrl) {
      return new Response(JSON.stringify({ error: "propertyId and imageUrl are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile and org info
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("organization_id, phone")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organization not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get org info (logo)
    const { data: org } = await serviceClient
      .from("organizations")
      .select("logo_url, name")
      .eq("id", profile.organization_id)
      .single();

    // Get property info
    const { data: property } = await serviceClient
      .from("properties")
      .select("title, sale_price, rent_price, transaction_type, bedrooms, parking_spots, area_built, area_total, address_neighborhood, address_city")
      .eq("id", propertyId)
      .single();

    const WEBHOOK_URL = Deno.env.get("GENERATE_ART_WEBHOOK");
    if (!WEBHOOK_URL) {
      return new Response(JSON.stringify({ error: "Art generation service not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build payload for the external art service
    const payload = {
      image_url: imageUrl,
      logo_url: org?.logo_url || null,
      org_name: org?.name || "",
      property: {
        title: property?.title || "",
        price: property?.transaction_type === "venda" ? property?.sale_price : property?.rent_price,
        transaction_type: property?.transaction_type,
        bedrooms: property?.bedrooms,
        parking: property?.parking_spots,
        area: property?.area_built || property?.area_total,
        neighborhood: property?.address_neighborhood,
        city: property?.address_city,
      },
      config: {
        main_text: config?.main_text || "",
        sub_text: config?.sub_text || "",
        phone: config?.phone || profile?.phone || "",
        slogan: config?.slogan || "",
        accent_color: config?.accent_color || "#3B82F6",
        logo_position: config?.logo_position || "bottom-right",
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Art service error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Falha ao gerar artes. Tente novamente." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();

    // Save to generated_arts table
    await serviceClient.from("generated_arts").insert({
      property_id: propertyId,
      organization_id: profile.organization_id,
      created_by: user.id,
      url_feed: result.url_feed || null,
      url_story: result.url_story || null,
      url_banner: result.url_banner || null,
      config: config || {},
    });

    return new Response(JSON.stringify({
      url_feed: result.url_feed || null,
      url_story: result.url_story || null,
      url_banner: result.url_banner || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-property-art error:", error);
    const message = error instanceof Error && error.name === "AbortError"
      ? "Tempo limite excedido. Tente novamente."
      : error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

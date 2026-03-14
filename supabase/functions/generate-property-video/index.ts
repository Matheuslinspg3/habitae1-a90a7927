import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Organização não encontrada" }), { status: 400, headers: corsHeaders });
    }

    const body = await req.json();
    const { property_id, photo_urls, duration_per_photo, format, has_narration, voice_used, include_logo, music_style, final_text } = body;

    if (!photo_urls || photo_urls.length < 3) {
      return new Response(JSON.stringify({ error: "Mínimo de 3 fotos" }), { status: 400, headers: corsHeaders });
    }

    const jobId = crypto.randomUUID();

    // Save to DB
    const { error: insertErr } = await supabase.from("generated_videos").insert({
      property_id,
      photo_urls,
      duration_per_photo: duration_per_photo || 3,
      format: format || "9:16",
      has_narration: has_narration || false,
      voice_used: has_narration ? voice_used : null,
      include_logo: include_logo !== false,
      music_style: music_style || "elegant",
      final_text: final_text || "",
      job_id: jobId,
      job_status: "processing",
      job_phase: "preparing_photos",
      organization_id: profile.organization_id,
      created_by: userId,
    });

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Erro ao salvar job" }), { status: 500, headers: corsHeaders });
    }

    // Get org logo
    const { data: org } = await supabase
      .from("organizations")
      .select("logo_url, name")
      .eq("id", profile.organization_id)
      .single();

    // Get property info for narration
    let propertyData = null;
    if (property_id) {
      const { data: prop } = await supabase
        .from("properties")
        .select("title, description, address_neighborhood, address_city, bedrooms, bathrooms, parking_spots, area_total, sale_price, rent_price")
        .eq("id", property_id)
        .single();
      propertyData = prop;
    }

    // Call external webhook
    const webhookUrl = Deno.env.get("GENERATE_VIDEO_WEBHOOK");
    if (webhookUrl) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            job_id: jobId,
            photo_urls,
            duration_per_photo,
            format,
            has_narration,
            voice_used,
            include_logo,
            music_style,
            final_text,
            logo_url: org?.logo_url,
            org_name: org?.name,
            property: propertyData,
            callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/video-job-status`,
          }),
        });
      } catch (e) {
        console.warn("Webhook call failed (non-blocking):", e);
      } finally {
        clearTimeout(timeout);
      }
    }

    return new Response(JSON.stringify({ job_id: jobId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("generate-property-video error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500, headers: corsHeaders });
  }
});

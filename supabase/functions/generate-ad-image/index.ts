import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface RequestBody {
  imageUrl: string;
  format: "feed" | "story";
  style: "enhance" | "template" | "overlay";
  overlayData?: {
    title?: string;
    price?: string;
    area?: string;
    bedrooms?: string;
    parking?: string;
    neighborhood?: string;
    phone?: string;
    logoUrl?: string;
  };
  customPrompt?: string;
}

function buildPrompt(body: RequestBody): string {
  const { format, style, overlayData, customPrompt } = body;

  const dimensions = format === "feed" ? "1080x1080 square" : "1080x1920 vertical (9:16 story)";

  if (customPrompt) {
    return `Edit this real estate photo to create a professional marketing piece in ${dimensions} format. ${customPrompt}`;
  }

  const baseInstructions = `Transform this real estate photo into a professional marketing advertisement in ${dimensions} format.`;

  if (style === "enhance") {
    return `${baseInstructions}
Enhance the photo with:
- Professional color grading and brightness
- Sharp, vivid colors
- Clean composition
- Modern, luxurious feel
Keep the original scene but make it look magazine-quality. Do NOT add any text or overlays.`;
  }

  if (style === "template") {
    const data = overlayData || {};
    return `${baseInstructions}
Create a real estate marketing template using this photo as the main visual:
- Add a modern, elegant frame/border design
- Add a semi-transparent overlay bar at the bottom or side
- Include the following text overlaid on the design:
  ${data.title ? `- Title: "${data.title}"` : ""}
  ${data.price ? `- Price: "${data.price}"` : ""}
  ${data.area ? `- Area: "${data.area}"` : ""}
  ${data.bedrooms ? `- Bedrooms: "${data.bedrooms}"` : ""}
  ${data.neighborhood ? `- Location: "${data.neighborhood}"` : ""}
  ${data.phone ? `- Contact: "${data.phone}"` : ""}
- Use clean sans-serif fonts, white or light text on dark overlay
- Professional real estate ad aesthetic
- Make it look like an Instagram ad from a premium real estate agency`;
  }

  // overlay style
  const data = overlayData || {};
  return `${baseInstructions}
Add a professional text overlay to this real estate photo:
${data.title ? `- Main headline: "${data.title}"` : ""}
${data.price ? `- Price tag: "${data.price}"` : ""}
${data.area ? `- Area info: "${data.area}"` : ""}
${data.bedrooms ? `- Bedrooms: "${data.bedrooms}"` : ""}
${data.phone ? `- Contact: "${data.phone}"` : ""}
- Use modern, bold typography
- Add subtle gradient or blur overlay behind text for readability
- Keep the photo visible and prominent
- Professional real estate advertisement style`;
}

Deno.serve(async (req) => {
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const body: RequestBody = await req.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(body);
    console.log(`[generate-ad-image] style=${body.style}, format=${body.format}`);

    const aiResponse = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text().catch(() => "");
      console.error(`AI gateway error: ${aiResponse.status}`, errText.slice(0, 300));

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Falha ao processar imagem com IA. Tente novamente." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResponse.json();
    const generatedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImageUrl) {
      console.error("No image in AI response:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "Nenhuma imagem foi gerada. Tente novamente." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log usage
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    await serviceClient.from("ai_usage_logs").insert({
      organization_id: profile?.organization_id || null,
      user_id: user.id,
      provider: "lovable",
      model: "gemini-2.5-flash-image",
      function_name: "generate-ad-image",
      usage_type: "image_edit",
      tokens_input: 0,
      tokens_output: 0,
      estimated_cost_usd: 0,
      success: true,
    });

    return new Response(JSON.stringify({ imageUrl: generatedImageUrl, promptUsed: prompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-ad-image error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

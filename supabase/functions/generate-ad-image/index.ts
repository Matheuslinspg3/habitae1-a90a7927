import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface OverlayData {
  title?: string;
  price?: string;
  area?: string;
  bedrooms?: string;
  parking?: string;
  neighborhood?: string;
  phone?: string;
  logoUrl?: string;
}

interface RequestBody {
  imageUrl: string;
  format: "feed" | "story";
  style: "enhance" | "template" | "overlay";
  overlayData?: OverlayData;
  customPrompt?: string;
  aiProvider?: "openai" | "gemini" | "stability" | "leonardo" | "flux";
}

function buildPrompt(body: RequestBody): string {
  const { format, style, overlayData, customPrompt } = body;
  const dimensions = format === "feed" ? "1080x1080 square" : "1080x1920 vertical (9:16 story)";

  // Base professional prompt for all styles
  const baseEnhancement = `You are a luxury real estate advertising visual designer.

VISUAL ENHANCEMENTS (apply to ALL styles):
- Improve lighting and colors for a premium look
- Enhance sky and sunlight for a cinematic feel
- Slightly improve landscaping and surroundings
- Keep the building architecture accurate and intact
- Ultra realistic rendering
- Modern luxury aesthetic
- High resolution output

CONSTRAINTS:
- Do not alter the building structure
- Avoid exaggerated effects
- Keep a professional commercial appearance`;

  if (customPrompt) {
    return `${baseEnhancement}

Create a professional real estate marketing piece in ${dimensions} format.

Additional instructions: ${customPrompt}`;
  }

  const data = overlayData || {};

  if (style === "enhance") {
    return `${baseEnhancement}

GOAL: Transform this property photo into a magazine-quality marketing image in ${dimensions} format.

COMPOSITION:
- Maintain the building as the main focal point
- Use a luxury real estate aesthetic
- Apply subtle cinematic lighting
- Keep a clean and modern visual style

Apply:
- Professional HDR-style color grading with warm, inviting tones
- Brighten shadows while preserving highlights
- Enhance sky to vivid blue or golden hour warmth
- Sharpen architectural details and textures
- Make grass/landscaping vibrant green
- Add subtle warm ambient lighting to interior shots
- Clean, luxurious, aspirational feel
- Do NOT add any text, logos, watermarks or overlays
- Keep the original composition and scene intact`;
  }

  if (style === "template") {
    const infoLines: string[] = [];
    if (data.title) infoLines.push(`Main headline: "${data.title}"`);
    if (data.price) infoLines.push(`Price prominently displayed: "${data.price}"`);
    if (data.area) infoLines.push(`Area: "${data.area}"`);
    if (data.bedrooms) infoLines.push(`Bedrooms: "${data.bedrooms}"`);
    if (data.parking) infoLines.push(`Parking: "${data.parking}"`);
    if (data.neighborhood) infoLines.push(`Location: "${data.neighborhood}"`);
    if (data.phone) infoLines.push(`Contact phone: "${data.phone}"`);

    return `${baseEnhancement}

GOAL: Create a high-end commercial advertisement image in ${dimensions} format using this property photo as the base reference.

COMPOSITION:
- Maintain the building as the main focal point
- Use the photo as the main hero visual, occupying most of the frame
- Apply subtle cinematic lighting
- Add a sophisticated, modern frame or border design (thin elegant lines, geometric accents)
- Create a semi-transparent dark gradient overlay at the bottom (30-40% of image height)
- The overlay should fade from fully transparent at top to 70% dark at bottom

TEXT SPACE — Reserve visual space for and render:
${infoLines.map(l => `- ${l}`).join("\n")}
- Logo or contact information area

TYPOGRAPHY:
- Use clean, modern sans-serif typography (Montserrat or Helvetica style)
- Title in bold white, large font size
- Price in accent gold/amber color, prominent
- Other details in light gray, smaller font
- Add subtle luxury design elements: thin gold lines, minimal icons for bed/area/parking

STYLE:
- Premium real estate agency Instagram ad
- Inspired by luxury property marketing from high-end agencies
- Clean, elegant, professional — NOT cluttered or cheap-looking
- Social media ready`;
  }

  // overlay style
  const infoLines: string[] = [];
  if (data.title) infoLines.push(`Bold headline: "${data.title}"`);
  if (data.price) infoLines.push(`Price tag with emphasis: "${data.price}"`);
  if (data.area) infoLines.push(`Area info: "${data.area}"`);
  if (data.bedrooms) infoLines.push(`Bedrooms: "${data.bedrooms}"`);
  if (data.phone) infoLines.push(`Contact: "${data.phone}"`);

  return `${baseEnhancement}

GOAL: Add professional text overlays to this property photo for a ${dimensions} real estate advertisement.

COMPOSITION:
- Maintain the building as the main focal point
- Keep the property photo prominent and visible (at least 70% of frame)

Text to overlay:
${infoLines.map(l => `- ${l}`).join("\n")}

Design instructions:
- Add a subtle gradient or frosted glass blur effect behind the text area for readability
- Use modern, bold sans-serif typography
- Title should be large and impactful
- Price should stand out with a distinct color (gold or brand accent)
- Text positioned at bottom third or as a clean sidebar
- Add small icons next to bedroom/area/parking data
- Professional, clean real estate ad aesthetic
- Do NOT cover the main subject of the photo with text
- Social media ready`;
}

/** Resolve input image (http(s) URL or data URL) to a Blob file for OpenAI */
async function resolveImageFile(url: string): Promise<{ imageBlob: Blob; mimeType: string; ext: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);

    const mimeType = (resp.headers.get("content-type") || "image/png").split(";")[0];
    if (!mimeType.startsWith("image/")) {
      throw new Error("Provided URL is not an image");
    }

    const imageBlob = await resp.blob();
    const ext = mimeType.includes("jpeg")
      ? "jpg"
      : mimeType.includes("png")
      ? "png"
      : mimeType.includes("webp")
      ? "webp"
      : mimeType.includes("gif")
      ? "gif"
      : "png";

    return { imageBlob, mimeType, ext };
  } finally {
    clearTimeout(timeoutId);
  }
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
    const provider = body.aiProvider || "openai";

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(body);
    console.log(`[generate-ad-image] provider=${provider}, style=${body.style}, format=${body.format}`);

    let generatedImageUrl: string | null = null;
    let modelUsed = "";

    if (provider === "gemini") {
      // ── Gemini via Lovable AI Gateway ──
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      modelUsed = "gemini-3-pro-image-preview";

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
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
        console.error(`Gemini gateway error: ${aiResponse.status}`, errText.slice(0, 300));
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Falha ao processar imagem com Gemini. Tente novamente." }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const geminiData = await aiResponse.json();
      generatedImageUrl = geminiData.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;

    } else if (provider === "stability") {
      // ── Stability AI (SDXL) ──
      const STABILITY_KEY = Deno.env.get("STABILITY_API_KEY") || Deno.env.get("IMAGE_STABILITY_KEY");
      if (!STABILITY_KEY) {
        // Try from ai_provider_config
        const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
        const { data: cfg } = await serviceClient.from("ai_provider_config").select("image_stability_key").eq("id", "singleton").single();
        const key = (cfg as any)?.image_stability_key;
        if (!key) {
          return new Response(JSON.stringify({ error: "Chave da Stability AI não configurada. Configure em Provedores de IA." }), {
            status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Use key from config
        modelUsed = "stable-diffusion-xl-1024-v1-0";
        const { imageBlob } = await resolveImageFile(imageUrl);
        const formData = new FormData();
        formData.append("init_image", imageBlob, "input.png");
        formData.append("text_prompts[0][text]", prompt);
        formData.append("text_prompts[0][weight]", "1");
        formData.append("cfg_scale", "7");
        formData.append("samples", "1");
        formData.append("image_strength", "0.35");

        const aiResponse = await fetch("https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
          body: formData,
        });
        if (!aiResponse.ok) {
          const errText = await aiResponse.text().catch(() => "");
          console.error(`Stability error: ${aiResponse.status}`, errText.slice(0, 300));
          return new Response(JSON.stringify({ error: `Erro Stability AI (${aiResponse.status}). Verifique créditos e chave.` }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const stabData = await aiResponse.json();
        const b64 = stabData.artifacts?.[0]?.base64;
        if (b64) generatedImageUrl = `data:image/png;base64,${b64}`;
      } else {
        modelUsed = "stable-diffusion-xl-1024-v1-0";
        const { imageBlob } = await resolveImageFile(imageUrl);
        const formData = new FormData();
        formData.append("init_image", imageBlob, "input.png");
        formData.append("text_prompts[0][text]", prompt);
        formData.append("text_prompts[0][weight]", "1");
        formData.append("cfg_scale", "7");
        formData.append("samples", "1");
        formData.append("image_strength", "0.35");

        const aiResponse = await fetch("https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image", {
          method: "POST",
          headers: { Authorization: `Bearer ${STABILITY_KEY}`, Accept: "application/json" },
          body: formData,
        });
        if (!aiResponse.ok) {
          const errText = await aiResponse.text().catch(() => "");
          console.error(`Stability error: ${aiResponse.status}`, errText.slice(0, 300));
          return new Response(JSON.stringify({ error: `Erro Stability AI (${aiResponse.status}).` }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const stabData = await aiResponse.json();
        const b64 = stabData.artifacts?.[0]?.base64;
        if (b64) generatedImageUrl = `data:image/png;base64,${b64}`;
      }

    } else if (provider === "leonardo") {
      // ── Leonardo AI ──
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: cfg } = await serviceClient.from("ai_provider_config").select("image_leonardo_key").eq("id", "singleton").single();
      const LEONARDO_KEY = (cfg as any)?.image_leonardo_key;
      if (!LEONARDO_KEY) {
        return new Response(JSON.stringify({ error: "Chave do Leonardo AI não configurada. Configure em Provedores de IA." }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      modelUsed = "leonardo-phoenix";
      const size = body.format === "feed" ? { width: 1024, height: 1024 } : { width: 1024, height: 1536 };

      // Leonardo uses generation endpoint with init image
      const genResponse = await fetch("https://cloud.leonardo.ai/api/rest/v1/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${LEONARDO_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          modelId: "6b645e3a-d64f-4341-a6d8-7a3690fbf042", // Leonardo Phoenix
          width: size.width,
          height: size.height,
          num_images: 1,
          init_image: imageUrl.startsWith("data:") ? undefined : imageUrl,
          init_strength: 0.35,
        }),
      });
      if (!genResponse.ok) {
        const errText = await genResponse.text().catch(() => "");
        console.error(`Leonardo error: ${genResponse.status}`, errText.slice(0, 300));
        return new Response(JSON.stringify({ error: `Erro Leonardo AI (${genResponse.status}). Verifique créditos e chave.` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const genData = await genResponse.json();
      const generationId = genData.sdGenerationJob?.generationId;
      if (generationId) {
        // Poll for result (up to 60s)
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const statusResp = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
            headers: { Authorization: `Bearer ${LEONARDO_KEY}` },
          });
          if (statusResp.ok) {
            const statusData = await statusResp.json();
            const images = statusData.generations_by_pk?.generated_images;
            if (images?.length > 0) {
              generatedImageUrl = images[0].url;
              break;
            }
          }
        }
      }

    } else if (provider === "flux") {
      // ── Flux Pro (BFL) ──
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: cfg } = await serviceClient.from("ai_provider_config").select("image_flux_key").eq("id", "singleton").single();
      const FLUX_KEY = (cfg as any)?.image_flux_key;
      if (!FLUX_KEY) {
        return new Response(JSON.stringify({ error: "Chave do Flux (BFL) não configurada. Configure em Provedores de IA." }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      modelUsed = "flux-pro";
      const size = body.format === "feed" ? { width: 1024, height: 1024 } : { width: 1024, height: 1536 };

      const fluxResp = await fetch("https://api.bfl.ml/v1/flux-pro-1.1", {
        method: "POST",
        headers: { "X-Key": FLUX_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          width: size.width,
          height: size.height,
          image: imageUrl.startsWith("data:") ? undefined : imageUrl,
          image_prompt_strength: 0.35,
        }),
      });
      if (!fluxResp.ok) {
        const errText = await fluxResp.text().catch(() => "");
        console.error(`Flux error: ${fluxResp.status}`, errText.slice(0, 300));
        return new Response(JSON.stringify({ error: `Erro Flux (${fluxResp.status}). Verifique créditos e chave.` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const fluxData = await fluxResp.json();
      const taskId = fluxData.id;
      if (taskId) {
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const pollResp = await fetch(`https://api.bfl.ml/v1/get_result?id=${taskId}`, {
            headers: { "X-Key": FLUX_KEY },
          });
          if (pollResp.ok) {
            const pollData = await pollResp.json();
            if (pollData.status === "Ready" && pollData.result?.sample) {
              generatedImageUrl = pollData.result.sample;
              break;
            }
          }
        }
      }

    } else {
      // ── OpenAI gpt-image-1 ──
      const OPENAI_API_KEY = Deno.env.get("OPENAI_IMAGE_API_KEY");
      if (!OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: "OPENAI_IMAGE_API_KEY not configured" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      modelUsed = "gpt-image-1";
      const size = body.format === "feed" ? "1024x1024" : "1024x1536";

      const { imageBlob, ext } = await resolveImageFile(imageUrl);
      const formData = new FormData();
      formData.append("image", imageBlob, `input.${ext}`);
      formData.append("prompt", prompt);
      formData.append("model", "gpt-image-1");
      formData.append("size", size);
      formData.append("quality", "high");

      const aiResponse = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: formData,
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text().catch(() => "");
        console.error(`OpenAI API error: ${aiResponse.status}`, errText.slice(0, 500));
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402 || aiResponse.status === 403) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes na API OpenAI ou chave inválida." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: `Falha ao processar imagem com OpenAI (${aiResponse.status}). Tente novamente.` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const openaiData = await aiResponse.json();
      const resultImage = openaiData.data?.[0];
      if (resultImage?.b64_json) {
        generatedImageUrl = `data:image/png;base64,${resultImage.b64_json}`;
      } else if (resultImage?.url) {
        generatedImageUrl = resultImage.url;
      }
    }

    if (!generatedImageUrl) {
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
      provider,
      model: modelUsed,
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Pricing per image (USD)
const IMAGE_PRICING: Record<string, number> = {
  "dall-e-3": 0.04,
  "stability-sd3": 0.035,
  "leonardo-kino-xl": 0.012,
  "flux-pro-1.1": 0.05,
  "lovable-gemini-image": 0,
};

interface ImageConfig {
  image_provider: string;
  lovable_fallback_enabled: boolean;
}

async function getImageConfig(supabase: any): Promise<ImageConfig> {
  const { data } = await supabase
    .from("ai_provider_config")
    .select("image_provider, lovable_fallback_enabled")
    .eq("id", "singleton")
    .single();
  return data || { image_provider: "lovable", lovable_fallback_enabled: true };
}

function getImageKey(provider: string): string | null {
  const map: Record<string, string> = {
    openai: "AI_OPENAI_KEY",
    stability: "AI_STABILITY_KEY",
    leonardo: "AI_LEONARDO_KEY",
    flux: "AI_FLUX_KEY",
  };
  return Deno.env.get(map[provider] || "") || null;
}

async function generateWithDALLE(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: `Professional real estate advertisement photo: ${prompt}`,
      n: 1, size: "1024x1024", response_format: "b64_json",
    }),
  });
  if (!res.ok) throw new Error(`DALL-E error: ${res.status}`);
  const data = await res.json();
  return `data:image/png;base64,${data.data[0].b64_json}`;
}

async function generateWithStability(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    body: (() => {
      const fd = new FormData();
      fd.append("prompt", `Professional real estate photo: ${prompt}`);
      fd.append("output_format", "png");
      fd.append("aspect_ratio", "1:1");
      return fd;
    })(),
  });
  if (!res.ok) throw new Error(`Stability AI error: ${res.status}`);
  const data = await res.json();
  return `data:image/png;base64,${data.image}`;
}

async function generateWithLeonardo(apiKey: string, prompt: string): Promise<string> {
  const genRes = await fetch("https://cloud.leonardo.ai/api/rest/v1/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `Professional real estate photo: ${prompt}`,
      modelId: "aa77f04e-3eec-4034-9c07-d0f619684628",
      width: 1024, height: 1024, num_images: 1,
    }),
  });
  if (!genRes.ok) throw new Error(`Leonardo error: ${genRes.status}`);
  const genData = await genRes.json();
  const generationId = genData.sdGenerationJob?.generationId;
  if (!generationId) throw new Error("Leonardo: no generation ID");

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();
    const images = pollData.generations_by_pk?.generated_images;
    if (images?.length > 0) return images[0].url;
  }
  throw new Error("Leonardo: timeout waiting for image");
}

async function generateWithFlux(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.bfl.ml/v1/flux-pro-1.1", {
    method: "POST",
    headers: { "X-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: `Professional real estate photo: ${prompt}`, width: 1024, height: 1024 }),
  });
  if (!res.ok) throw new Error(`Flux error: ${res.status}`);
  const data = await res.json();
  const taskId = data.id;
  if (!taskId) throw new Error("Flux: no task ID");

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(`https://api.bfl.ml/v1/get_result?id=${taskId}`, { headers: { "X-Key": apiKey } });
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();
    if (pollData.status === "Ready" && pollData.result?.sample) return pollData.result.sample;
  }
  throw new Error("Flux: timeout waiting for image");
}

async function generateWithLovable(prompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(LOVABLE_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: `Generate a professional, photorealistic real estate advertisement image. High quality, bright natural lighting, modern design. ${prompt}` }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) throw new Error(`Lovable AI image error: ${res.status}`);
  const data = await res.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl) throw new Error("No image generated");
  return imageUrl;
}

function getModelForProvider(provider: string): string {
  const map: Record<string, string> = {
    openai: "dall-e-3",
    stability: "stability-sd3",
    leonardo: "leonardo-kino-xl",
    flux: "flux-pro-1.1",
    lovable: "lovable-gemini-image",
  };
  return map[provider] || "lovable-gemini-image";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { prompt } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const imgConfig = await getImageConfig(serviceClient);

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    let imageUrl: string | null = null;
    let usedProvider = "lovable";
    const errors: string[] = [];
    const provider = imgConfig.image_provider;

    try {
      console.log(`Trying image provider: ${provider}`);
      const apiKey = getImageKey(provider);
      if (provider === "openai" && apiKey) {
        imageUrl = await generateWithDALLE(apiKey, prompt);
        usedProvider = "openai";
      } else if (provider === "stability" && apiKey) {
        imageUrl = await generateWithStability(apiKey, prompt);
        usedProvider = "stability";
      } else if (provider === "leonardo" && apiKey) {
        imageUrl = await generateWithLeonardo(apiKey, prompt);
        usedProvider = "leonardo";
      } else if (provider === "flux" && apiKey) {
        imageUrl = await generateWithFlux(apiKey, prompt);
        usedProvider = "flux";
      }
    } catch (err: any) {
      errors.push(`${provider}: ${err.message}`);
      console.warn(`${provider} failed:`, err.message);
    }

    if (!imageUrl && (provider === "lovable" || imgConfig.lovable_fallback_enabled)) {
      try {
        console.log("Using Lovable AI for image...");
        imageUrl = await generateWithLovable(prompt);
        usedProvider = "lovable";
      } catch (err: any) {
        errors.push(`Lovable: ${err.message}`);
        console.error("Lovable AI image failed:", err.message);
      }
    }

    // Log usage
    const model = getModelForProvider(usedProvider);
    const cost = IMAGE_PRICING[model] || 0;

    await serviceClient.from("ai_usage_logs").insert({
      organization_id: profile?.organization_id || null,
      user_id: user.id,
      provider: usedProvider,
      model,
      function_name: "generate-ad-image",
      usage_type: "image",
      tokens_input: 0,
      tokens_output: 0,
      estimated_cost_usd: cost,
      success: !!imageUrl,
      error_message: imageUrl ? null : errors.join("; "),
    });

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Todos os provedores de imagem falharam: " + errors.join("; ") }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ imageUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("generate-ad-image error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

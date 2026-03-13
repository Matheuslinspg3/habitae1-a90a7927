import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface ImageConfig {
  image_provider: string;
  image_sd_url: string | null;
  image_openai_key: string | null;
  image_custom_url: string | null;
  image_custom_key: string | null;
  lovable_fallback_enabled: boolean;
}

async function getImageConfig(supabase: any): Promise<ImageConfig> {
  const { data } = await supabase
    .from("ai_provider_config")
    .select("image_provider, image_sd_url, image_openai_key, image_custom_url, image_custom_key, lovable_fallback_enabled")
    .eq("id", "singleton")
    .single();

  return data || { image_provider: "lovable", lovable_fallback_enabled: true } as ImageConfig;
}

async function generateWithSD(sdUrl: string, prompt: string): Promise<string> {
  const res = await fetch(`${sdUrl}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `professional real estate photo, ${prompt}`,
      negative_prompt: "blurry, low quality, text, watermark, logo, distorted",
      steps: 20,
      cfg_scale: 7,
      width: 1024,
      height: 1024,
      sampler_name: "DPM++ 2M Karras",
    }),
  });

  if (!res.ok) throw new Error(`Stable Diffusion error: ${res.status}`);
  const data = await res.json();
  return `data:image/png;base64,${data.images[0]}`;
}

async function generateWithDALLE(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: `Professional real estate advertisement photo: ${prompt}`,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });

  if (!res.ok) throw new Error(`DALL-E error: ${res.status}`);
  const data = await res.json();
  return `data:image/png;base64,${data.data[0].b64_json}`;
}

async function generateWithCustom(url: string, apiKey: string | null, prompt: string): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) throw new Error(`Custom image API error: ${res.status}`);
  const data = await res.json();
  // Expect either imageUrl or base64 in response
  return data.imageUrl || data.image_url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
}

async function generateWithLovable(prompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const res = await fetch(LOVABLE_GATEWAY, {
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
          content: `Generate a professional, photorealistic real estate advertisement image. High quality, bright natural lighting, modern design. ${prompt}`,
        },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) throw new Error(`Lovable AI image error: ${res.status}`);
  const data = await res.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl) throw new Error("No image generated");
  return imageUrl;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
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

    const { prompt } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load config
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const imgConfig = await getImageConfig(serviceClient);

    let imageUrl: string | null = null;
    const errors: string[] = [];
    const provider = imgConfig.image_provider;

    // Try configured provider
    if (provider === "stable_diffusion" && imgConfig.image_sd_url) {
      try {
        console.log("Trying Stable Diffusion...");
        imageUrl = await generateWithSD(imgConfig.image_sd_url, prompt);
      } catch (err: any) {
        errors.push(`SD: ${err.message}`);
        console.warn("SD failed:", err.message);
      }
    } else if (provider === "openai" && imgConfig.image_openai_key) {
      try {
        console.log("Trying DALL-E...");
        imageUrl = await generateWithDALLE(imgConfig.image_openai_key, prompt);
      } catch (err: any) {
        errors.push(`DALL-E: ${err.message}`);
        console.warn("DALL-E failed:", err.message);
      }
    } else if (provider === "custom" && imgConfig.image_custom_url) {
      try {
        console.log("Trying Custom Image API...");
        imageUrl = await generateWithCustom(imgConfig.image_custom_url, imgConfig.image_custom_key, prompt);
      } catch (err: any) {
        errors.push(`Custom: ${err.message}`);
        console.warn("Custom failed:", err.message);
      }
    }

    // Fallback to Lovable AI
    if (!imageUrl) {
      try {
        console.log("Falling back to Lovable AI for image...");
        imageUrl = await generateWithLovable(prompt);
      } catch (err: any) {
        errors.push(`Lovable: ${err.message}`);
        console.error("Lovable AI image also failed:", err.message);
      }
    }

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Todos os provedores de imagem falharam: " + errors.join("; ") }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-ad-image error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

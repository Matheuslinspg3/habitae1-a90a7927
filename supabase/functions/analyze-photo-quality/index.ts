import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { trackAiBilling } from "../_shared/ai-billing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ quality: "unknown", message: "Análise indisponível" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em qualidade de fotos para anúncios imobiliários. Analise a imagem e responda APENAS com um JSON: { \"quality\": \"good\" ou \"low\", \"reason\": \"motivo curto em PT-BR\" }. Critérios: resolução, iluminação, enquadramento, nitidez. Seja conciso."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analise a qualidade desta foto para uso em arte de anúncio imobiliário." },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ],
        temperature: 0.2,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ quality: "unknown", message: "Análise indisponível" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const tokensIn = data.usage?.prompt_tokens || 0;
    const tokensOut = data.usage?.completion_tokens || 0;

    // Track billing (no user auth here, use anonymous tracking)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);
      await trackAiBilling(supabase, {
        userId: "system",
        provider: "lovable",
        model: "google/gemini-2.5-flash",
        functionName: "analyze-photo-quality",
        inputTokens: tokensIn,
        outputTokens: tokensOut,
        success: true,
        usageType: "vision",
      });
    }

    // Parse the JSON from the response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify({
          quality: parsed.quality || "unknown",
          message: parsed.reason || "Análise concluída",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      // fallback
    }

    return new Response(JSON.stringify({ quality: "unknown", message: "Análise inconclusiva" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-photo-quality error:", error);
    return new Response(
      JSON.stringify({ quality: "unknown", message: "Erro na análise" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

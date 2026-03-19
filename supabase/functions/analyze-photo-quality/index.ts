import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { trackAiBilling } from "../_shared/ai-billing.ts";
import { callGeminiOpenAIChat, fetchImageAsDataUrl } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "gemini-2.5-flash";

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

    const imageDataUrl = await fetchImageAsDataUrl(imageUrl);
    const data = await callGeminiOpenAIChat({
      body: {
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "Você é um especialista em qualidade de fotos para anúncios imobiliários. Analise a imagem e responda APENAS com um JSON: { \"quality\": \"good\" ou \"low\", \"reason\": \"motivo curto em PT-BR\" }. Critérios: resolução, iluminação, enquadramento, nitidez. Seja conciso.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analise a qualidade desta foto para uso em arte de anúncio imobiliário." },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 150,
      },
    });

    const content = data.choices?.[0]?.message?.content || "";
    const tokensIn = data.usage?.prompt_tokens || 0;
    const tokensOut = data.usage?.completion_tokens || 0;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);

      await supabase.from("ai_usage_logs").insert({
        user_id: "system",
        provider: "gemini",
        model: MODEL,
        function_name: "analyze-photo-quality",
        usage_type: "vision",
        tokens_input: tokensIn,
        tokens_output: tokensOut,
        estimated_cost_usd: (tokensIn / 1000) * 0.00015 + (tokensOut / 1000) * 0.0006,
        success: true,
      });

      await trackAiBilling(supabase, {
        userId: "system",
        provider: "gemini",
        model: MODEL,
        functionName: "analyze-photo-quality",
        inputTokens: tokensIn,
        outputTokens: tokensOut,
        success: true,
        usageType: "vision",
      });
    }

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(
          JSON.stringify({
            quality: parsed.quality || "unknown",
            message: parsed.reason || "Análise concluída",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    } catch {
      // fallback below
    }

    return new Response(JSON.stringify({ quality: "unknown", message: "Análise inconclusiva" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-photo-quality error:", error);
    return new Response(JSON.stringify({ quality: "unknown", message: "Análise indisponível" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

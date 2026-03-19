import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { trackAiBilling } from "../_shared/ai-billing.ts";
import { callGeminiOpenAIChat, fetchImageAsDataUrl, getGeminiApiKeys } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "gemini-2.5-flash-lite";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { document_id, storage_path, expected_type } = await req.json();
    if (!document_id || !storage_path) {
      return new Response(JSON.stringify({ error: "Missing params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: signedData, error: signedError } = await supabase.storage
      .from("lead-documents")
      .createSignedUrl(storage_path, 300);

    if (signedError || !signedData?.signedUrl) {
      throw new Error("Failed to get signed URL");
    }

    const hasGeminiKeys = getGeminiApiKeys().length > 0;
    if (!hasGeminiKeys) {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isImage = storage_path.match(/\.(jpg|jpeg|png)$/i);
    let aiResult: any;

    if (isImage) {
      const imageDataUrl = await fetchImageAsDataUrl(signedData.signedUrl);
      try {
        const aiData = await callGeminiOpenAIChat({
          body: {
            model: MODEL,
            messages: [
              {
                role: "system",
                content:
                  "You are a document validation assistant for a real estate CRM. Analyze the image and determine what type of document it is. Respond ONLY with a JSON object with these fields: detected_type (string in Portuguese), confidence (number 0-1), valid (boolean), observation (string in Portuguese with brief observation).",
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Analise este documento e identifique o tipo. É esperado ser um documento pessoal ou imobiliário.${expected_type ? ` Tipo esperado: ${expected_type}.` : ""}`,
                  },
                  { type: "image_url", image_url: { url: imageDataUrl } },
                ],
              },
            ],
          },
        });

        const content = aiData.choices?.[0]?.message?.content || "";
        const tokensIn = aiData.usage?.prompt_tokens || 0;
        const tokensOut = aiData.usage?.completion_tokens || 0;

        await supabase.from("ai_usage_logs").insert({
          user_id: "system",
          provider: "gemini",
          model: MODEL,
          function_name: "validate-document",
          usage_type: "vision",
          tokens_input: tokensIn,
          tokens_output: tokensOut,
          estimated_cost_usd: (tokensIn / 1000) * 0.0001 + (tokensOut / 1000) * 0.0004,
          success: true,
        });

        await trackAiBilling(supabase, {
          userId: "system",
          provider: "gemini",
          model: MODEL,
          functionName: "validate-document",
          inputTokens: tokensIn,
          outputTokens: tokensOut,
          success: true,
          usageType: "vision",
        });

        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          aiResult = jsonMatch
            ? JSON.parse(jsonMatch[0])
            : { valid: false, detected_type: "desconhecido", confidence: 0, observation: content };
        } catch {
          aiResult = { valid: false, detected_type: "desconhecido", confidence: 0, observation: content.slice(0, 200) };
        }
      } catch (error) {
        console.error("AI error:", error);
        aiResult = { valid: false, detected_type: "desconhecido", confidence: 0, observation: "Não foi possível validar automaticamente" };
      }
    } else {
      aiResult = { valid: true, detected_type: "PDF", confidence: 0.5, observation: "Documento PDF — verificação manual recomendada" };
    }

    await supabase.from("lead_documents").update({ ai_validation: aiResult }).eq("id", document_id);

    return new Response(JSON.stringify(aiResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

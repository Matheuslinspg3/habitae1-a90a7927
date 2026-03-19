import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGeminiOpenAIChat } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "gemini-2.5-flash";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { contractType, templateName, description } = await req.json();
    const typeLabel = contractType === "locacao" ? "Locação" : contractType === "ambos" ? "Venda e Locação" : "Venda";

    const systemPrompt = `Você é um advogado imobiliário brasileiro especialista em redigir contratos.
Gere um modelo de contrato de ${typeLabel} completo e profissional em HTML.

REGRAS:
- Use as seguintes variáveis dinâmicas onde apropriado (NÃO invente outras):
  {{nome_cliente}}, {{cpf_cliente}}, {{email_cliente}}, {{telefone_cliente}},
  {{endereco_imovel}}, {{codigo_imovel}}, {{titulo_imovel}},
  {{valor_contrato}}, {{tipo_contrato}}, {{data_inicio}}, {{data_fim}},
  {{corretor_nome}}, {{comissao}}, {{dia_pagamento}}, {{indice_reajuste}}, {{data_atual}}
- Use tags HTML simples: <p>, <h2>, <h3>, <strong>, <em>, <ol>, <ul>, <li>
- NÃO use <html>, <head>, <body>, <style> ou CSS inline
- Inclua cláusulas padrão: objeto, preço, pagamento, obrigações, rescisão, foro
- Para locação inclua: prazo, reajuste, garantias, vistoria
- Seja formal e juridicamente correto
- Retorne APENAS o HTML do corpo do contrato, sem explicações`;

    const userPrompt = templateName
      ? `Gere um contrato com o título "${templateName}"${description ? `. Detalhes: ${description}` : ""}.`
      : `Gere um contrato padrão de ${typeLabel} para imóveis.`;

    const data = await callGeminiOpenAIChat({
      body: {
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
    });

    let html = data.choices?.[0]?.message?.content || "";
    html = html.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("generate-contract-template error:", err);
    const message = err?.message || "Erro ao gerar template";
    const status = message.includes("429") ? 429 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

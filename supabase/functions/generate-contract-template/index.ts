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
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { contractType, templateName, description } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro no gateway de IA");
    }

    const data = await response.json();
    let html = data.choices?.[0]?.message?.content || "";

    // Strip markdown code fences if present
    html = html.replace(/^```html?\n?/i, "").replace(/\n?```$/i, "").trim();

    return new Response(
      JSON.stringify({ html }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-contract-template error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao gerar template" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

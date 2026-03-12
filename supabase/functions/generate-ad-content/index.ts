import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
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

    const { formData, leadName } = await req.json();

    if (!formData?.tipo || !formData?.finalidade || !formData?.bairro_cidade) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const propertyDesc = buildPropertyDescription(formData);

    const systemPrompt = `Você é um copywriter imobiliário profissional brasileiro com experiência em anúncios para Facebook Ads, portais imobiliários e WhatsApp. Gere textos prontos para publicar, persuasivos e que convertem.`;

    const userPrompt = `Gere 3 versões de anúncio para este imóvel:

${propertyDesc}

${leadName ? `Cliente alvo: ${leadName}` : ""}

Retorne usando a função generate_ads.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "generate_ads",
          description: "Gera 3 versões de anúncio imobiliário para diferentes plataformas",
          parameters: {
            type: "object",
            properties: {
              portal: {
                type: "string",
                description: "Texto completo para portal imobiliário (OLX/ZAP). Profissional, detalhado, sem emojis, 150-250 palavras. Inclua título, descrição e call-to-action.",
              },
              instagram: {
                type: "string",
                description: "Texto para Instagram/Facebook Ads. Envolvente, com emojis estratégicos, máximo 150 palavras. Inclua hashtags relevantes no final e CTA forte.",
              },
              whatsapp: {
                type: "string",
                description: `Mensagem curta para WhatsApp${leadName ? ` personalizada para ${leadName}` : ""}. Máximo 80 palavras, até 3 emojis, direta e com call-to-action.`,
              },
              image_prompts: {
                type: "array",
                items: { type: "string" },
                description: "3 prompts em inglês para gerar imagens profissionais do imóvel para anúncio. Cada prompt deve descrever uma cena diferente: exterior/fachada, interior/sala principal, e um diferencial (piscina, vista, varanda, etc). Prompts devem ser detalhados para gerar imagens fotorealistas de alta qualidade.",
              },
            },
            required: ["portal", "instagram", "whatsapp", "image_prompts"],
          },
        },
      },
    ];

    const response = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "generate_ads" } },
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      throw new Error(`AI error: ${response.status}`);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response format");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-ad-content error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildPropertyDescription(data: any): string {
  const parts = [
    `Tipo: ${data.tipo}`,
    `Finalidade: ${data.finalidade}`,
    `Localização: ${data.bairro_cidade}`,
  ];
  if (data.valor) parts.push(`Valor: R$ ${Number(data.valor).toLocaleString("pt-BR")}`);
  if (data.metragem) parts.push(`Metragem: ${data.metragem} m²`);
  if (data.quartos) parts.push(`Quartos: ${data.quartos}`);
  if (data.suites) parts.push(`Suítes: ${data.suites}`);
  if (data.vagas) parts.push(`Vagas: ${data.vagas}`);
  if (data.diferenciais) parts.push(`Diferenciais: ${data.diferenciais}`);
  return parts.join("\n");
}

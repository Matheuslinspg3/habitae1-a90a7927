import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface AIConfig {
  text_provider: string;
  text_openai_key: string | null;
  text_openai_model: string | null;
  text_gemini_key: string | null;
  text_anthropic_key: string | null;
  text_groq_key: string | null;
  lovable_fallback_enabled: boolean;
}

async function getAIConfig(supabase: any): Promise<AIConfig> {
  const { data } = await supabase
    .from("ai_provider_config")
    .select("text_provider, text_openai_key, text_openai_model, text_gemini_key, text_anthropic_key, text_groq_key, lovable_fallback_enabled")
    .eq("id", "singleton")
    .single();

  return data || { text_provider: "lovable", lovable_fallback_enabled: true } as AIConfig;
}

async function callOpenAI(apiKey: string, model: string, messages: any[], tools?: any[], toolChoice?: any): Promise<any> {
  const body: any = { model, messages, temperature: 0.8 };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  return await res.json();
}

async function callGemini(apiKey: string, messages: any[], tools?: any[], toolChoice?: any): Promise<any> {
  // Use Gemini via OpenAI-compatible endpoint
  const body: any = { model: "gemini-2.0-flash", messages, temperature: 0.8 };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  return await res.json();
}

async function callAnthropic(apiKey: string, messages: any[], tools?: any[], toolChoice?: any): Promise<any> {
  const systemMsg = messages.find((m: any) => m.role === "system");
  const userMsgs = messages.filter((m: any) => m.role !== "system");

  const anthropicTools = tools?.map((t: any) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));

  const body: any = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: userMsgs,
    ...(systemMsg ? { system: systemMsg.content } : {}),
    ...(anthropicTools ? { tools: anthropicTools } : {}),
    ...(toolChoice ? { tool_choice: { type: "tool", name: toolChoice.function.name } } : {}),
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
  const data = await res.json();

  // Convert Anthropic response to OpenAI format
  const toolUse = data.content?.find((c: any) => c.type === "tool_use");
  if (toolUse) {
    return {
      choices: [{
        message: {
          tool_calls: [{
            function: { name: toolUse.name, arguments: JSON.stringify(toolUse.input) },
          }],
        },
      }],
    };
  }
  const textContent = data.content?.find((c: any) => c.type === "text");
  return { choices: [{ message: { content: textContent?.text || "" } }] };
}

async function callGroq(apiKey: string, messages: any[], tools?: any[], toolChoice?: any): Promise<any> {
  const body: any = { model: "llama-3.1-70b-versatile", messages, temperature: 0.8 };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Groq error: ${res.status}`);
  return await res.json();
}

async function callLovable(messages: any[], tools?: any[], toolChoice?: any): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const body: any = { model: "google/gemini-2.5-flash", messages, temperature: 0.8 };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const res = await fetch(LOVABLE_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limit atingido");
    if (res.status === 402) throw new Error("Créditos de IA esgotados");
    throw new Error(`Lovable AI error: ${res.status}`);
  }
  return await res.json();
}

function extractToolResult(aiData: any): any {
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    return JSON.parse(toolCall.function.arguments);
  }
  const content = aiData.choices?.[0]?.message?.content;
  if (content) {
    try { return JSON.parse(content); } catch { /* ignore */ }
  }
  return null;
}

const tools = [
  {
    type: "function",
    function: {
      name: "generate_ads",
      description: "Gera 3 versões de anúncio imobiliário para diferentes plataformas",
      parameters: {
        type: "object",
        properties: {
          portal: { type: "string", description: "Texto completo para portal imobiliário (OLX/ZAP). Profissional, detalhado, sem emojis, 150-250 palavras." },
          instagram: { type: "string", description: "Texto para Instagram/Facebook Ads. Envolvente, com emojis estratégicos, máximo 150 palavras. Inclua hashtags." },
          whatsapp: { type: "string", description: "Mensagem curta para WhatsApp. Máximo 80 palavras, até 3 emojis, direta e com call-to-action." },
          image_prompts: { type: "array", items: { type: "string" }, description: "3 prompts em inglês para gerar imagens profissionais do imóvel." },
        },
        required: ["portal", "instagram", "whatsapp", "image_prompts"],
      },
    },
  },
];
const toolChoice = { type: "function", function: { name: "generate_ads" } };

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

    const { formData, leadName } = await req.json();
    if (!formData?.tipo || !formData?.finalidade || !formData?.bairro_cidade) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const aiConfig = await getAIConfig(serviceClient);

    const propertyDesc = buildPropertyDescription(formData);
    const systemPrompt = `Você é um copywriter imobiliário profissional brasileiro com experiência em anúncios para Facebook Ads, portais imobiliários e WhatsApp. Gere textos prontos para publicar, persuasivos e que convertem.`;
    const userPrompt = `Gere 3 versões de anúncio para este imóvel:\n\n${propertyDesc}\n\n${leadName ? `Cliente alvo: ${leadName}` : ""}\n\nRetorne usando a função generate_ads.`;
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    let result: any = null;
    const errors: string[] = [];
    const provider = aiConfig.text_provider;

    // Try configured provider
    try {
      console.log(`Trying text provider: ${provider}`);
      let aiData: any;

      if (provider === "openai" && aiConfig.text_openai_key) {
        aiData = await callOpenAI(aiConfig.text_openai_key, aiConfig.text_openai_model || "gpt-4o", messages, tools, toolChoice);
        result = extractToolResult(aiData);
      } else if (provider === "gemini" && aiConfig.text_gemini_key) {
        aiData = await callGemini(aiConfig.text_gemini_key, messages, tools, toolChoice);
        result = extractToolResult(aiData);
      } else if (provider === "anthropic" && aiConfig.text_anthropic_key) {
        aiData = await callAnthropic(aiConfig.text_anthropic_key, messages, tools, toolChoice);
        result = extractToolResult(aiData);
      } else if (provider === "groq" && aiConfig.text_groq_key) {
        aiData = await callGroq(aiConfig.text_groq_key, messages, tools, toolChoice);
        result = extractToolResult(aiData);
      }
      // lovable is handled in fallback below
    } catch (err: any) {
      errors.push(`${provider}: ${err.message}`);
      console.warn(`${provider} failed:`, err.message);
    }

    // Fallback to Lovable AI
    if (!result && (provider === "lovable" || aiConfig.lovable_fallback_enabled)) {
      try {
        console.log("Using Lovable AI...");
        const aiData = await callLovable(messages, tools, toolChoice);
        result = extractToolResult(aiData);
      } catch (err: any) {
        errors.push(`Lovable: ${err.message}`);
        console.error("Lovable AI failed:", err.message);
      }
    }

    if (!result) {
      return new Response(
        JSON.stringify({ error: "Todos os provedores de IA falharam: " + errors.join("; ") }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!result.image_prompts) result.image_prompts = [];

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

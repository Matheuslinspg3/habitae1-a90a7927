import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Pricing per 1M tokens (USD)
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  "google/gemini-2.5-flash": { input: 0.15, output: 0.6 },
  "google/gemini-3-flash-preview": { input: 0.15, output: 0.6 },
};

function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICING[model] || { input: 0, output: 0 };
  return (tokensIn * p.input + tokensOut * p.output) / 1_000_000;
}

interface AIConfig {
  text_provider: string;
  text_openai_model: string | null;
  lovable_fallback_enabled: boolean;
  text_openai_key: string | null;
  text_gemini_key: string | null;
  text_anthropic_key: string | null;
  text_groq_key: string | null;
}

async function getAIConfig(supabase: any): Promise<AIConfig> {
  const { data } = await supabase
    .from("ai_provider_config")
    .select("text_provider, text_openai_model, lovable_fallback_enabled, text_openai_key, text_gemini_key, text_anthropic_key, text_groq_key")
    .eq("id", "singleton")
    .single();
  return data || { text_provider: "lovable", text_openai_model: "gpt-4o", lovable_fallback_enabled: true, text_openai_key: null, text_gemini_key: null, text_anthropic_key: null, text_groq_key: null };
}

function getTextKey(provider: string, config: AIConfig): string | null {
  const map: Record<string, string | null> = {
    openai: config.text_openai_key,
    gemini: config.text_gemini_key,
    anthropic: config.text_anthropic_key,
    groq: config.text_groq_key,
  };
  return map[provider] || null;
}

async function callLovable(messages: any[], tools?: any[], toolChoice?: any) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  const body: any = { model: "google/gemini-3-flash-preview", messages, temperature: 0.7 };
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

function extractToolResult(aiData: any) {
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) return JSON.parse(toolCall.function.arguments);
  const content = aiData.choices?.[0]?.message?.content;
  if (content) { try { return JSON.parse(content); } catch { /* */ } }
  return null;
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  formal: "Use linguagem formal, técnica e profissional. Sem gírias ou emojis no portal.",
  emocional: "Use linguagem envolvente, emocional e inspiradora. Faça o leitor se imaginar morando lá.",
  direto: "Seja extremamente direto e objetivo. Vá direto ao ponto sem rodeios.",
  luxo: "Use linguagem sofisticada, elegante e exclusiva. Transmita luxo e exclusividade.",
};

function buildTools(channel?: string) {
  // If regenerating a single channel, only require that channel
  const allProps: Record<string, any> = {
    portal: { type: "string", description: "Texto completo para portal imobiliário (OLX/ZAP). Profissional, detalhado, sem emojis, 600-1500 caracteres." },
    instagram: { type: "string", description: "Texto para Instagram/Facebook Ads. Envolvente, com emojis estratégicos, máximo 150 palavras. Inclua hashtags." },
    whatsapp: { type: "string", description: "Mensagem curta para WhatsApp. Máximo 80 palavras, até 3 emojis, direta e com call-to-action." },
    image_prompts: { type: "array", items: { type: "string" }, description: "3 prompts em inglês para gerar imagens profissionais do imóvel." },
  };

  if (channel && channel !== "all") {
    // Single channel regeneration
    const props: Record<string, any> = {};
    if (allProps[channel]) props[channel] = allProps[channel];
    return [{
      type: "function",
      function: {
        name: "generate_ads",
        description: `Gera versão de anúncio imobiliário para ${channel}`,
        parameters: { type: "object", properties: props, required: Object.keys(props) },
      },
    }];
  }

  return [{
    type: "function",
    function: {
      name: "generate_ads",
      description: "Gera 3 versões de anúncio imobiliário para diferentes plataformas",
      parameters: {
        type: "object",
        properties: allProps,
        required: ["portal", "instagram", "whatsapp", "image_prompts"],
      },
    },
  }];
}

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

    const { formData, leadName, tone, channel } = await req.json();
    if (!formData?.tipo || !formData?.finalidade || !formData?.bairro_cidade) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const aiConfig = await getAIConfig(serviceClient);

    const propertyDesc = buildPropertyDescription(formData);
    const toneInstruction = TONE_INSTRUCTIONS[tone || "formal"] || TONE_INSTRUCTIONS.formal;
    
    const channelInstruction = channel && channel !== "all"
      ? `\n\nGere APENAS a versão para ${channel}. Retorne usando a função generate_ads com apenas o campo "${channel}".`
      : `\n\nRetorne usando a função generate_ads.`;

    const systemPrompt = `You are a professional real estate copywriter specialized in high-conversion property advertisements.

GOAL
Generate persuasive marketing text for a real estate advertisement based on the property information provided.

TASK
Create structured real estate marketing copy optimized for advertisements across multiple platforms.

STYLE GUIDELINES
- Professional real estate marketing tone
- Short, impactful sentences
- Focus on value and lifestyle
- Avoid unnecessary verbosity
- Make it suitable for social media ads, real estate listings, or brochures
- ${toneInstruction}

CONSTRAINTS
- Keep total output under 1,200 characters per platform
- Avoid repeating information across platforms
- Prioritize clarity and persuasion

For the Portal version, structure as:
1. HEADLINE — Strong luxury-style headline (max 10 words)
2. SUBHEADLINE — Complementary sentence reinforcing value
3. SHORT DESCRIPTION — 2-3 sentences about lifestyle, comfort, exclusivity
4. BULLET POINT HIGHLIGHTS — 4-6 attractive features
5. CALL TO ACTION — Short, persuasive CTA

For Instagram, use engaging copy with strategic emojis and hashtags.
For WhatsApp, keep it short (max 80 words) with a direct CTA.

LANGUAGE: Generate in Brazilian Portuguese (pt-BR).`;

    const userPrompt = `Gere ${channel && channel !== "all" ? `a versão ${channel} do` : "3 versões de"} anúncio para este imóvel:\n\n${propertyDesc}\n\n${leadName ? `Cliente alvo: ${leadName}` : ""}${channelInstruction}`;
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // Get user's org
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    let result: any = null;
    let usedProvider = "lovable";
    let usedModel = "google/gemini-3-flash-preview";
    let aiData: any = null;
    const errors: string[] = [];
    const provider = aiConfig.text_provider;
    const tools = buildTools(channel);

    // Try configured provider first
    try {
      console.log(`Trying text provider: ${provider}`);
      const apiKey = getTextKey(provider, aiConfig);

      if (provider === "openai" && apiKey) {
        usedModel = aiConfig.text_openai_model || "gpt-4o";
        const body: any = { model: usedModel, messages, temperature: 0.7, tools, tool_choice: toolChoice };
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
        aiData = await res.json();
        result = extractToolResult(aiData);
        usedProvider = "openai";
      } else if (provider === "gemini" && apiKey) {
        usedModel = "gemini-2.0-flash";
        const body: any = { model: usedModel, messages, temperature: 0.7, tools, tool_choice: toolChoice };
        const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
        aiData = await res.json();
        result = extractToolResult(aiData);
        usedProvider = "gemini";
      } else if (provider === "anthropic" && apiKey) {
        usedModel = "claude-sonnet-4-20250514";
        const systemMsg = messages.find((m: any) => m.role === "system");
        const userMsgs = messages.filter((m: any) => m.role !== "system");
        const anthropicTools = tools.map((t: any) => ({
          name: t.function.name, description: t.function.description, input_schema: t.function.parameters,
        }));
        const body: any = {
          model: usedModel, max_tokens: 4096, messages: userMsgs,
          ...(systemMsg ? { system: systemMsg.content } : {}),
          tools: anthropicTools,
          tool_choice: { type: "tool", name: "generate_ads" },
        };
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
        const data = await res.json();
        const toolUse = data.content?.find((c: any) => c.type === "tool_use");
        if (toolUse) {
          aiData = { choices: [{ message: { tool_calls: [{ function: { name: toolUse.name, arguments: JSON.stringify(toolUse.input) } }] } }], usage: data.usage ? { prompt_tokens: data.usage.input_tokens, completion_tokens: data.usage.output_tokens } : undefined };
        } else {
          const textContent = data.content?.find((c: any) => c.type === "text");
          aiData = { choices: [{ message: { content: textContent?.text || "" } }], usage: data.usage ? { prompt_tokens: data.usage.input_tokens, completion_tokens: data.usage.output_tokens } : undefined };
        }
        result = extractToolResult(aiData);
        usedProvider = "anthropic";
      } else if (provider === "groq" && apiKey) {
        usedModel = "llama-3.3-70b-versatile";
        const body: any = { model: usedModel, messages, temperature: 0.7, tools, tool_choice: "auto" };
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const groqErrorText = await res.text();
          throw new Error(`Groq error: ${res.status} - ${groqErrorText.slice(0, 300)}`);
        }
        aiData = await res.json();
        result = extractToolResult(aiData);
        usedProvider = "groq";
      }
    } catch (err: any) {
      errors.push(`${provider}: ${err.message}`);
      console.warn(`${provider} failed:`, err.message);
    }

    // Fallback to Lovable AI
    if (!result && (provider === "lovable" || aiConfig.lovable_fallback_enabled || provider === "groq")) {
      try {
        console.log("Using Lovable AI...");
        aiData = await callLovable(messages, tools, toolChoice);
        result = extractToolResult(aiData);
        usedProvider = "lovable";
        usedModel = "google/gemini-3-flash-preview";
      } catch (err: any) {
        errors.push(`Lovable: ${err.message}`);
        console.error("Lovable AI failed:", err.message);
      }
    }

    // Log usage
    const tokensIn = aiData?.usage?.prompt_tokens || 0;
    const tokensOut = aiData?.usage?.completion_tokens || 0;
    const cost = estimateCost(usedModel, tokensIn, tokensOut);

    await serviceClient.from("ai_usage_logs").insert({
      organization_id: profile?.organization_id || null,
      user_id: user.id,
      provider: usedProvider,
      model: usedModel,
      function_name: "generate-ad-content",
      usage_type: "text",
      tokens_input: tokensIn,
      tokens_output: tokensOut,
      estimated_cost_usd: cost,
      success: !!result,
      error_message: result ? null : errors.join("; "),
    });

    if (!result) {
      return new Response(
        JSON.stringify({ error: "Todos os provedores de IA falharam: " + errors.join("; ") }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!result.image_prompts) result.image_prompts = [];
    return new Response(JSON.stringify({ ...result, _ai_provider: usedProvider, _ai_model: usedModel }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

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
  text_ollama_url: string | null;
  text_ollama_model: string | null;
  text_openai_key: string | null;
  text_openai_model: string | null;
  text_custom_url: string | null;
  text_custom_key: string | null;
  text_custom_model: string | null;
  lovable_fallback_enabled: boolean;
}

async function getAIConfig(supabase: any): Promise<AIConfig> {
  const { data } = await supabase
    .from("ai_provider_config")
    .select("text_provider, text_ollama_url, text_ollama_model, text_openai_key, text_openai_model, text_custom_url, text_custom_key, text_custom_model")
    .eq("id", "singleton")
    .single();

  return data || { text_provider: "lovable" } as AIConfig;
}

async function callOllama(config: AIConfig, messages: any[]): Promise<string> {
  const url = config.text_ollama_url || "http://localhost:11434";
  const model = config.text_ollama_model || "llama3";

  // Convert messages to single prompt for Ollama generate API
  const prompt = messages.map((m: any) => 
    m.role === "system" ? m.content : `${m.role}: ${m.content}`
  ).join("\n\n");

  const res = await fetch(`${url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false, prompt }),
  });

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const json = await res.json();
  return json.response;
}

async function callOpenAI(apiKey: string, model: string, messages: any[], tools?: any[], toolChoice?: any): Promise<any> {
  const body: any = { model, messages, temperature: 0.8 };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  return await res.json();
}

async function callCustom(url: string, apiKey: string | null, model: string, messages: any[], tools?: any[], toolChoice?: any): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const body: any = { model, messages, temperature: 0.8 };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Custom AI error: ${res.status}`);
  return await res.json();
}

async function callLovable(messages: any[], tools?: any[], toolChoice?: any): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const body: any = {
    model: "google/gemini-2.5-flash",
    messages,
    temperature: 0.8,
  };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const res = await fetch(LOVABLE_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
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
  // Fallback: try to parse content as JSON
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
            description: "Mensagem curta para WhatsApp. Máximo 80 palavras, até 3 emojis, direta e com call-to-action.",
          },
          image_prompts: {
            type: "array",
            items: { type: "string" },
            description: "3 prompts em inglês para gerar imagens profissionais do imóvel. Cada prompt deve descrever uma cena diferente. Devem ser detalhados para imagens fotorealistas.",
          },
        },
        required: ["portal", "instagram", "whatsapp", "image_prompts"],
      },
    },
  },
];
const toolChoice = { type: "function", function: { name: "generate_ads" } };

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

    const { formData, leadName } = await req.json();
    if (!formData?.tipo || !formData?.finalidade || !formData?.bairro_cidade) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load AI config
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

    // Try configured provider first
    const provider = aiConfig.text_provider;

    if (provider === "ollama") {
      try {
        console.log("Trying Ollama...");
        const rawText = await callOllama(aiConfig, messages);
        // Ollama doesn't support tools, try to parse JSON from response
        try {
          result = JSON.parse(rawText);
        } catch {
          // If not JSON, wrap it
          result = { portal: rawText, instagram: rawText, whatsapp: rawText, image_prompts: [] };
        }
      } catch (err: any) {
        errors.push(`Ollama: ${err.message}`);
        console.warn("Ollama failed:", err.message);
      }
    } else if (provider === "openai" && aiConfig.text_openai_key) {
      try {
        console.log("Trying OpenAI...");
        const aiData = await callOpenAI(aiConfig.text_openai_key, aiConfig.text_openai_model || "gpt-4o-mini", messages, tools, toolChoice);
        result = extractToolResult(aiData);
      } catch (err: any) {
        errors.push(`OpenAI: ${err.message}`);
        console.warn("OpenAI failed:", err.message);
      }
    } else if (provider === "custom" && aiConfig.text_custom_url) {
      try {
        console.log("Trying Custom API...");
        const aiData = await callCustom(aiConfig.text_custom_url, aiConfig.text_custom_key, aiConfig.text_custom_model || "default", messages, tools, toolChoice);
        result = extractToolResult(aiData);
      } catch (err: any) {
        errors.push(`Custom: ${err.message}`);
        console.warn("Custom API failed:", err.message);
      }
    }

    // Fallback to Lovable AI if no result yet
    if (!result) {
      try {
        console.log("Falling back to Lovable AI...");
        const aiData = await callLovable(messages, tools, toolChoice);
        result = extractToolResult(aiData);
      } catch (err: any) {
        errors.push(`Lovable: ${err.message}`);
        console.error("Lovable AI also failed:", err.message);
      }
    }

    if (!result) {
      return new Response(
        JSON.stringify({ error: "Todos os provedores de IA falharam: " + errors.join("; ") }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure image_prompts exists
    if (!result.image_prompts) {
      result.image_prompts = [];
    }

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

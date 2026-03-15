import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_URL = "https://n8n.costazul.shop/webhook/lovableportadocorrerora";
const MAX_AI_QUESTIONS = 3;

// --- AI Provider Config ---
const GROQ_KEYS = [
  Deno.env.get("GROQ_API_KEY_1"),
  Deno.env.get("GROQ_API_KEY_2"),
].filter(Boolean) as string[];

const GOOGLE_AI_KEYS = [
  Deno.env.get("GOOGLE_AI_KEY_1"),
  Deno.env.get("GOOGLE_AI_KEY_2"),
].filter(Boolean) as string[];

const GROQ_MODEL = "llama-3.1-8b-instant";
const GOOGLE_MODEL = "gemini-2.0-flash";

let groqKeyIndex = 0;
let googleKeyIndex = 0;

function nextGroqKey(): string | null {
  if (GROQ_KEYS.length === 0) return null;
  const key = GROQ_KEYS[groqKeyIndex % GROQ_KEYS.length];
  groqKeyIndex++;
  return key;
}

function nextGoogleKey(): string | null {
  if (GOOGLE_AI_KEYS.length === 0) return null;
  const key = GOOGLE_AI_KEYS[googleKeyIndex % GOOGLE_AI_KEYS.length];
  googleKeyIndex++;
  return key;
}

// --- AI Call Functions ---
async function callGroq(messages: any[]): Promise<string | null> {
  for (let attempt = 0; attempt < GROQ_KEYS.length; attempt++) {
    const key = nextGroqKey();
    if (!key) return null;
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.4, max_tokens: 1024 }),
      });
      if (res.status === 429) {
        console.warn(`Groq key ${attempt + 1} rate limited, trying next...`);
        continue;
      }
      if (!res.ok) {
        console.error(`Groq error: ${res.status}`, await res.text());
        continue;
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (err) {
      console.error(`Groq connection error (key ${attempt + 1}):`, err);
    }
  }
  return null;
}

async function callGoogleAI(messages: any[]): Promise<string | null> {
  for (let attempt = 0; attempt < GOOGLE_AI_KEYS.length; attempt++) {
    const key = nextGoogleKey();
    if (!key) return null;
    try {
      // Convert OpenAI-style messages to Gemini format
      const systemInstruction = messages.find((m: any) => m.role === "system")?.content || "";
      const contents = messages
        .filter((m: any) => m.role !== "system")
        .map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
          }),
        }
      );
      if (res.status === 429) {
        console.warn(`Google AI key ${attempt + 1} rate limited, trying next...`);
        continue;
      }
      if (!res.ok) {
        console.error(`Google AI error: ${res.status}`, await res.text());
        continue;
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (err) {
      console.error(`Google AI connection error (key ${attempt + 1}):`, err);
    }
  }
  return null;
}

async function callAI(messages: any[]): Promise<{ content: string; provider: string; success: boolean }> {
  // Try Groq first
  const groqResult = await callGroq(messages);
  if (groqResult) return { content: groqResult, provider: "groq", success: true };

  // Fallback to Google AI Studio
  const googleResult = await callGoogleAI(messages);
  if (googleResult) return { content: googleResult, provider: "google", success: true };

  return {
    content: "Desculpe, não consegui processar sua mensagem. O suporte técnico foi notificado.",
    provider: "none",
    success: false,
  };
}

// --- Main Handler ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { ticket_id, message } = await req.json();
    if (!ticket_id || !message) {
      return new Response(JSON.stringify({ error: "ticket_id and message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (GROQ_KEYS.length === 0 && GOOGLE_AI_KEYS.length === 0) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get ticket info
    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", ticket_id)
      .single();

    if (ticketError || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save user message
    await supabase.from("ticket_messages").insert({
      ticket_id,
      sender_role: "user",
      sender_id: user.id,
      content: message,
    });

    // Get conversation history
    const { data: history } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticket_id)
      .order("created_at", { ascending: true })
      .limit(50);

    // Count existing AI messages to track anamnesis progress
    const aiMessageCount = (history || []).filter((m: any) => m.sender_role === "ai").length;
    const questionsRemaining = MAX_AI_QUESTIONS - aiMessageCount;
    const isLastQuestion = questionsRemaining <= 1;

    // Build system prompt
    const systemPrompt = buildSystemPrompt(ticket, aiMessageCount, questionsRemaining, isLastQuestion);

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => ({
        role: m.sender_role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    // Call AI with fallback
    const aiResult = await callAI(aiMessages);

    // Log AI usage
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    await supabase.from("ai_usage_logs").insert({
      organization_id: userProfile?.organization_id || null,
      user_id: user.id,
      provider: aiResult.provider,
      model: aiResult.provider === "groq" ? GROQ_MODEL : GOOGLE_MODEL,
      function_name: "ticket-chat",
      usage_type: "text",
      tokens_input: 0,
      tokens_output: 0,
      estimated_cost_usd: 0,
      success: aiResult.success,
    });

    // Save AI response
    await supabase.from("ticket_messages").insert({
      ticket_id,
      sender_role: "ai",
      sender_id: null,
      content: aiResult.content,
    });

    // Send webhook AFTER last AI question (anamnesis complete)
    if (isLastQuestion) {
      await handleAnamnesisComplete(supabase, ticket, user, aiResult, ticket_id);
    }

    return new Response(JSON.stringify({
      reply: aiResult.content,
      anamnesis_complete: isLastQuestion,
      questions_remaining: isLastQuestion ? 0 : questionsRemaining - 1,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ticket-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildSystemPrompt(ticket: any, aiMessageCount: number, questionsRemaining: number, isLastQuestion: boolean): string {
  const context = `Contexto do ticket:
- Assunto: ${ticket.subject}
- Descrição: ${ticket.description}
- Categoria: ${ticket.category}`;

  if (isLastQuestion) {
    return `Você é o assistente de suporte técnico da plataforma Porta do Corretor, um sistema de gestão imobiliária para corretores e imobiliárias.

${context}

Esta é sua ÚLTIMA interação com o usuário. Você já fez ${aiMessageCount} perguntas de diagnóstico.
Agora você DEVE:
1. Agradecer as informações fornecidas
2. Fazer um RESUMO TÉCNICO COMPLETO do problema identificado, incluindo:
   - Módulo/funcionalidade afetada
   - Passos para reproduzir
   - Impacto no uso da plataforma
3. Sugerir possíveis soluções ou workarounds se possível
4. Informar que o diagnóstico será enviado à equipe técnica

REGRAS IMPORTANTES:
- O nome da plataforma é "Porta do Corretor", NUNCA chame de "Habitae" ou outro nome
- NÃO invente informações que o usuário não forneceu
- NÃO invente erros, URLs ou códigos de status que não foram mencionados
- Baseie-se EXCLUSIVAMENTE no que o usuário disse
- Responda em português brasileiro, de forma clara e profissional`;
  }

  return `Você é o assistente de suporte técnico da plataforma Porta do Corretor, um sistema de gestão imobiliária para corretores e imobiliárias.

${context}

Você está realizando uma ANAMNESE TÉCNICA para diagnosticar o problema do usuário.
Já fez ${aiMessageCount} pergunta(s). Faltam ${questionsRemaining} pergunta(s).

REGRAS:
- Faça APENAS UMA pergunta por resposta
- Seja direto e específico
- Pergunte sobre: qual tela/módulo, qual ação estava executando, qual erro apareceu, quando começou, se é recorrente, qual navegador/dispositivo
- NÃO tente resolver ainda, apenas colete informações
- NÃO faça resumo ainda
- NÃO faça listas de perguntas, faça UMA pergunta por vez
- O nome da plataforma é "Porta do Corretor", NUNCA chame de "Habitae" ou outro nome
- NÃO invente informações, erros ou URLs que o usuário não mencionou
- Responda em português brasileiro, de forma empática e objetiva`;
}

async function handleAnamnesisComplete(
  supabase: any, ticket: any, user: any, aiResult: { content: string; provider: string; success: boolean }, ticket_id: string
) {
  const { data: fullHistory } = await supabase
    .from("ticket_messages")
    .select("sender_role, content, created_at")
    .eq("ticket_id", ticket_id)
    .order("created_at", { ascending: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, organization_id")
    .eq("user_id", user.id)
    .single();

  let orgName = "Desconhecida";
  if (profile?.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .single();
    orgName = org?.name || orgName;
  }

  const conversationLog = (fullHistory || []).map((m: any) => ({
    role: m.sender_role,
    content: m.content,
    timestamp: m.created_at,
  }));

  const webhookPayload = {
    type: "ticket_anamnesis_complete",
    ticket_id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    category: ticket.category,
    status: ticket.status,
    created_at: ticket.created_at,
    source: "porta_do_corretor",
    project_id: "32f18075-f5bc-4619-801e-39da715b91b0",
    user_id: user.id,
    user_name: profile?.full_name || "Desconhecido",
    user_email: user.email || "",
    organization_name: orgName,
    ai_provider: aiResult.provider,
    ai_success: aiResult.success,
    ai_conclusion: aiResult.content,
    conversation_history: conversationLog,
    total_messages: conversationLog.length,
  };

  fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(webhookPayload),
  }).catch((err) => console.error("Webhook error:", err));

  await supabase
    .from("support_tickets")
    .update({ status: "in_progress" })
    .eq("id", ticket_id);
}

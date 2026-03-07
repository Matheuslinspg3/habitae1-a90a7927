import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OLLAMA_BASE_URL = "https://costazulagente-ollama.n32vzc.easypanel.host";
const OLLAMA_MODEL = "gemma:2b";
const WEBHOOK_URL = "https://n8n.costazul.shop/webhook/lovableportadocorrerora";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { ticket_id, message } = await req.json();
    if (!ticket_id || !message) {
      return new Response(JSON.stringify({ error: "ticket_id and message required" }), {
        status: 400,
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

    const systemPrompt = `Você é o assistente de suporte técnico da plataforma Habitae (Porta do Corretor), um sistema de gestão imobiliária.
Seu papel é realizar uma ANAMNESE TÉCNICA do problema reportado pelo usuário.

Contexto do ticket:
- Assunto: ${ticket.subject}
- Descrição: ${ticket.description}
- Categoria: ${ticket.category}
- Status: ${ticket.status}

Siga este processo de diagnóstico:
1. Faça perguntas específicas para entender o problema (qual tela, qual ação, que erro aparece, quando começou)
2. Sugira soluções práticas baseadas nas funcionalidades da plataforma (imóveis, CRM, contratos, financeiro, agenda, integrações, importação)
3. Se identificar o problema, forneça a solução passo a passo
4. Se o problema persistir ou for complexo, informe que será escalado para suporte humano

Responda em português brasileiro, de forma clara, empática e objetiva.
Não invente funcionalidades que não existem. Se não souber, diga claramente.`;

    const ollamaMessages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => ({
        role: m.sender_role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    // Call Ollama
    let aiContent = "Desculpe, não consegui processar sua mensagem. O suporte técnico foi notificado.";
    let aiDiagnosticSuccess = false;

    try {
      const aiResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: ollamaMessages,
          stream: false,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        aiContent = aiData.message?.content || aiContent;
        aiDiagnosticSuccess = true;
      } else {
        console.error("Ollama error:", aiResponse.status, await aiResponse.text());
      }
    } catch (ollamaErr) {
      console.error("Ollama connection error:", ollamaErr);
    }

    // Save AI response
    await supabase.from("ticket_messages").insert({
      ticket_id,
      sender_role: "ai",
      sender_id: null,
      content: aiContent,
    });

    // Get user profile for webhook
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

    // Send webhook 1: Normal ticket notification
    const ticketPayload = {
      type: "ticket_message",
      ticket_id: ticket.id,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      status: ticket.status,
      source: "porta_do_corretor",
      project_id: "32f18075-f5bc-4619-801e-39da715b91b0",
      user_id: user.id,
      user_name: profile?.full_name || "Desconhecido",
      user_email: user.email || "",
      organization_name: orgName,
      user_message: message,
    };

    // Send webhook 2: AI diagnostic conclusion
    const aiPayload = {
      type: "ai_diagnostic",
      ticket_id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      user_name: profile?.full_name || "Desconhecido",
      organization_name: orgName,
      user_message: message,
      ai_response: aiContent,
      ai_success: aiDiagnosticSuccess,
      ai_model: OLLAMA_MODEL,
    };

    // Fire-and-forget both webhooks
    Promise.allSettled([
      fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ticketPayload),
      }),
      fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiPayload),
      }),
    ]).catch((err) => console.error("Webhook error:", err));

    return new Response(JSON.stringify({ reply: aiContent }), {
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

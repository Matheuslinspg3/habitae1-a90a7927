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
const MAX_AI_QUESTIONS = 3;

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

    // Count existing AI messages to track anamnesis progress
    const aiMessageCount = (history || []).filter((m: any) => m.sender_role === "ai").length;
    const questionsRemaining = MAX_AI_QUESTIONS - aiMessageCount;
    const isLastQuestion = questionsRemaining <= 1;

    // Build system prompt based on anamnesis stage
    let systemPrompt: string;

    if (isLastQuestion) {
      // Final question - conclude the diagnosis
      systemPrompt = `Você é o assistente de suporte técnico da plataforma Habitae (Porta do Corretor), um sistema de gestão imobiliária.

Contexto do ticket:
- Assunto: ${ticket.subject}
- Descrição: ${ticket.description}
- Categoria: ${ticket.category}

Esta é sua ÚLTIMA interação com o usuário. Você já fez ${aiMessageCount} perguntas de diagnóstico.
Agora você DEVE:
1. Agradecer as informações fornecidas
2. Fazer um RESUMO TÉCNICO COMPLETO do problema identificado, incluindo:
   - Módulo/funcionalidade afetada
   - Passos para reproduzir
   - Impacto no uso da plataforma
3. Sugerir possíveis soluções ou workarounds se possível
4. Informar que o diagnóstico será enviado à equipe técnica

Responda em português brasileiro, de forma clara e profissional.`;
    } else {
      // Still gathering information
      systemPrompt = `Você é o assistente de suporte técnico da plataforma Habitae (Porta do Corretor), um sistema de gestão imobiliária.

Contexto do ticket:
- Assunto: ${ticket.subject}
- Descrição: ${ticket.description}
- Categoria: ${ticket.category}

Você está realizando uma ANAMNESE TÉCNICA. Você deve fazer exatamente ${MAX_AI_QUESTIONS} perguntas no total para diagnosticar o problema.
Já fez ${aiMessageCount} pergunta(s). Faltam ${questionsRemaining} pergunta(s).

REGRAS:
- Faça APENAS UMA pergunta por resposta
- Seja direto e específico
- Pergunte sobre: qual tela/módulo, qual ação estava executando, qual erro apareceu, quando começou, se é recorrente, qual navegador/dispositivo
- NÃO tente resolver ainda, apenas colete informações
- NÃO faça resumo ainda

Responda em português brasileiro, de forma empática e objetiva.`;
    }

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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const aiResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: ollamaMessages,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

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

    // Only send webhook AFTER the last AI question (anamnesis complete)
    if (isLastQuestion) {
      // Get full conversation history for webhook
      const { data: fullHistory } = await supabase
        .from("ticket_messages")
        .select("sender_role, content, created_at")
        .eq("ticket_id", ticket_id)
        .order("created_at", { ascending: true });

      // Get user profile
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

      // Format conversation for webhook
      const conversationLog = (fullHistory || []).map((m: any) => ({
        role: m.sender_role,
        content: m.content,
        timestamp: m.created_at,
      }));

      // Send ONE webhook with ticket + full anamnesis
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
        ai_model: OLLAMA_MODEL,
        ai_success: aiDiagnosticSuccess,
        ai_conclusion: aiContent,
        conversation_history: conversationLog,
        total_messages: conversationLog.length,
      };

      fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload),
      }).catch((err) => console.error("Webhook error:", err));

      // Update ticket status to indicate anamnesis is done
      await supabase
        .from("support_tickets")
        .update({ status: "in_progress" })
        .eq("id", ticket_id);
    }

    return new Response(JSON.stringify({
      reply: aiContent,
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

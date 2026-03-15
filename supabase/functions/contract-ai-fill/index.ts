import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { trackAiBilling } from "../_shared/ai-billing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authErr,
    } = await anonClient.auth.getUser(token);
    if (authErr || !user) throw new Error("Não autorizado");

    // Get user org
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.organization_id) throw new Error("Organização não encontrada");

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
      throw new Error("Prompt inválido");
    }

    // Fetch org data for context
    const [leadsRes, propertiesRes, brokersRes] = await Promise.all([
      supabase
        .from("leads")
        .select("id, name, email, phone, estimated_value")
        .eq("organization_id", profile.organization_id)
        .eq("is_active", true)
        .limit(500),
      supabase
        .from("properties")
        .select("id, title, property_code, sale_price, rent_price, transaction_type, address_city, address_neighborhood, status")
        .eq("organization_id", profile.organization_id)
        .limit(500),
      supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("organization_id", profile.organization_id)
        .limit(100),
    ]);

    const leads = leadsRes.data || [];
    const properties = propertiesRes.data || [];
    const brokers = brokersRes.data || [];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = `Você é um assistente de contratos imobiliários. O usuário vai descrever um contrato de forma livre (nome do cliente, código do imóvel, etc). Você deve identificar os dados e retornar o preenchimento do contrato.

DADOS DISPONÍVEIS:
Clientes (leads): ${JSON.stringify(leads.map((l) => ({ id: l.id, name: l.name, email: l.email })))}

Imóveis: ${JSON.stringify(properties.map((p) => ({ id: p.id, title: p.title, code: p.property_code, sale_price: p.sale_price, rent_price: p.rent_price, type: p.transaction_type, city: p.address_city })))}

Corretores: ${JSON.stringify(brokers.map((b) => ({ id: b.user_id, name: b.full_name })))}

REGRAS:
- Faça match fuzzy pelo nome do cliente com os leads disponíveis
- Faça match pelo código do imóvel (property_code) com os imóveis disponíveis
- Se o imóvel for de venda, use sale_price como valor; se locação, use rent_price
- Determine o tipo do contrato (venda/locacao) pelo transaction_type do imóvel
- Se o usuário mencionar um corretor, faça match pelo nome
- Data de início padrão: hoje (${new Date().toISOString().split("T")[0]})
- Status padrão: rascunho`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "fill_contract",
                description:
                  "Preenche os campos do contrato com os dados identificados",
                parameters: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["venda", "locacao"],
                      description: "Tipo do contrato",
                    },
                    property_id: {
                      type: "string",
                      description: "UUID do imóvel encontrado, ou null",
                    },
                    lead_id: {
                      type: "string",
                      description: "UUID do lead/cliente encontrado, ou null",
                    },
                    broker_id: {
                      type: "string",
                      description: "UUID do corretor encontrado, ou null",
                    },
                    value: {
                      type: "number",
                      description: "Valor do contrato baseado no preço do imóvel",
                    },
                    commission_percentage: {
                      type: "number",
                      description: "Percentual de comissão (padrão 6 para venda, 10 para locação)",
                    },
                    start_date: {
                      type: "string",
                      description: "Data de início no formato YYYY-MM-DD",
                    },
                    end_date: {
                      type: "string",
                      description: "Data de fim (para locação, 30 meses padrão)",
                    },
                    payment_day: {
                      type: "number",
                      description: "Dia de pagamento (para locação, padrão 10)",
                    },
                    readjustment_index: {
                      type: "string",
                      description: "Índice de reajuste (para locação, padrão IGPM)",
                    },
                    notes: {
                      type: "string",
                      description: "Observações adicionais geradas pela IA",
                    },
                    summary: {
                      type: "string",
                      description: "Resumo do que foi preenchido e quais matches foram encontrados",
                    },
                  },
                  required: ["type", "value", "summary"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "fill_contract" },
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      throw new Error("Erro na IA");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("IA não retornou dados estruturados");
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("contract-ai-fill error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

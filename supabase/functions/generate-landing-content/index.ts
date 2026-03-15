import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PropertyData {
  id: string;
  title: string;
  description: string | null;
  property_type: { name: string } | null;
  transaction_type: string;
  sale_price: number | null;
  rent_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  suites: number | null;
  parking_spots: number | null;
  area_total: number | null;
  area_built: number | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  amenities: string[] | null;
  condominium_fee: number | null;
  iptu: number | null;
  floor: number | null;
}

// --- Groq Config (free tier) ---
const GROQ_KEYS = [
  Deno.env.get("GROQ_LANDING_KEY_1"),
  Deno.env.get("GROQ_LANDING_KEY_2"),
].filter(Boolean) as string[];

const GROQ_MODEL = "llama-3.1-8b-instant";
let groqKeyIndex = 0;

function nextGroqKey(): string | null {
  if (GROQ_KEYS.length === 0) return null;
  const key = GROQ_KEYS[groqKeyIndex % GROQ_KEYS.length];
  groqKeyIndex++;
  return key;
}

async function callGroq(messages: any[], tools: any[], toolChoice: any): Promise<any> {
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
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          tools,
          tool_choice: toolChoice,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });
      if (res.status === 429) {
        console.warn(`Groq landing key ${attempt + 1} rate limited, trying next...`);
        continue;
      }
      if (!res.ok) {
        console.error(`Groq error: ${res.status}`, await res.text());
        continue;
      }
      return await res.json();
    } catch (err) {
      console.error(`Groq connection error (key ${attempt + 1}):`, err);
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (GROQ_KEYS.length === 0) {
      throw new Error("AI not configured (no Groq keys)");
    }

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { propertyId, forceRegenerate = false } = await req.json();

    if (!propertyId) {
      return new Response(
        JSON.stringify({ error: "propertyId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache
    if (!forceRegenerate) {
      const { data: existingContent } = await supabase
        .from("property_landing_content")
        .select("*")
        .eq("property_id", propertyId)
        .single();

      if (existingContent) {
        const generatedAt = new Date(existingContent.generated_at);
        const now = new Date();
        const hoursDiff = (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
          return new Response(
            JSON.stringify({ content: existingContent, cached: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Fetch property data
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select(`*, property_type:property_types(name)`)
      .eq("id", propertyId)
      .single();

    if (propertyError || !property) {
      return new Response(
        JSON.stringify({ error: "Property not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prop = property as PropertyData;
    const propertyContext = buildPropertyContext(prop);

    const systemPrompt = `Você é um copywriter especializado em marketing imobiliário de alto padrão no Brasil. 
Seu objetivo é criar textos persuasivos e únicos para landing pages de imóveis que convertem visitantes em leads qualificados.

Diretrizes:
- Use linguagem emocional que evoque desejo e urgência
- Destaque os diferenciais únicos do imóvel
- Crie headlines impactantes e memoráveis
- Use técnicas de copywriting como AIDA (Atenção, Interesse, Desejo, Ação)
- Adapte o tom ao perfil do imóvel (luxo, familiar, investimento)
- Seja específico sobre características e benefícios
- Crie CTAs (Call to Action) persuasivos e variados
- Considere o contexto do bairro e região
- NUNCA invente informações não fornecidas`;

    const tools = [
      {
        type: "function",
        function: {
          name: "generate_landing_content",
          description: "Gera conteúdo persuasivo para landing page de imóvel",
          parameters: {
            type: "object",
            properties: {
              headline: {
                type: "string",
                description: "Título principal impactante (máx 80 caracteres)."
              },
              subheadline: {
                type: "string",
                description: "Subtítulo complementar (máx 120 caracteres)."
              },
              description_persuasive: {
                type: "string",
                description: "Descrição persuasiva e concisa do imóvel (100-180 palavras, 2-3 parágrafos curtos)."
              },
              key_features: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    icon: { type: "string", description: "Nome do ícone Lucide (ex: 'Sun', 'Shield', 'Leaf')" },
                    title: { type: "string", description: "Título curto do diferencial" },
                    description: { type: "string", description: "Descrição breve do benefício" }
                  },
                  required: ["icon", "title", "description"]
                },
                description: "Lista de 3-5 diferenciais únicos do imóvel com ícones"
              },
              cta_primary: {
                type: "string",
                description: "Call to Action principal"
              },
              cta_secondary: {
                type: "string",
                description: "Call to Action secundário"
              },
              seo_title: {
                type: "string",
                description: "Título SEO otimizado (máx 60 caracteres)"
              },
              seo_description: {
                type: "string",
                description: "Meta description SEO (máx 160 caracteres)"
              }
            },
            required: ["headline", "subheadline", "description_persuasive", "key_features", "cta_primary", "seo_title", "seo_description"]
          }
        }
      }
    ];

    const toolChoice = { type: "function", function: { name: "generate_landing_content" } };

    const aiData = await callGroq(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: propertyContext },
      ],
      tools,
      toolChoice
    );

    if (!aiData) {
      return new Response(
        JSON.stringify({ error: "Todas as chaves de IA estão indisponíveis. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response format");
    }

    const generatedContent = JSON.parse(toolCall.function.arguments);

    // Upsert the generated content
    const { data: savedContent, error: saveError } = await supabase
      .from("property_landing_content")
      .upsert({
        property_id: propertyId,
        headline: generatedContent.headline,
        subheadline: generatedContent.subheadline,
        description_persuasive: generatedContent.description_persuasive,
        key_features: generatedContent.key_features,
        cta_primary: generatedContent.cta_primary,
        cta_secondary: generatedContent.cta_secondary || null,
        seo_title: generatedContent.seo_title,
        seo_description: generatedContent.seo_description,
        generated_at: new Date().toISOString(),
        model_used: `groq/${GROQ_MODEL}`,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "property_id"
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving content:", saveError);
      return new Response(
        JSON.stringify({ content: generatedContent, cached: false, saveError: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ content: savedContent, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-landing-content:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildPropertyContext(prop: PropertyData): string {
  const formatPrice = (price: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);

  const transactionTypeLabels: Record<string, string> = {
    venda: "Venda",
    aluguel: "Aluguel",
    ambos: "Venda ou Aluguel"
  };

  let context = `Gere conteúdo de marketing para esta landing page de imóvel:

## DADOS DO IMÓVEL

**Título Original:** ${prop.title}
**Tipo:** ${prop.property_type?.name || "Imóvel"}
**Transação:** ${transactionTypeLabels[prop.transaction_type] || prop.transaction_type}
`;

  if (prop.sale_price) {
    context += `**Preço de Venda:** ${formatPrice(prop.sale_price)}\n`;
  }
  if (prop.rent_price) {
    context += `**Preço de Aluguel:** ${formatPrice(prop.rent_price)}/mês\n`;
  }

  context += `
## CARACTERÍSTICAS
- Quartos: ${prop.bedrooms || 0}${prop.suites ? ` (${prop.suites} suíte${prop.suites > 1 ? 's' : ''})` : ''}
- Banheiros: ${prop.bathrooms || 0}
- Vagas: ${prop.parking_spots || 0}
- Área Total: ${prop.area_total || 'Não informada'}m²
${prop.area_built ? `- Área Construída: ${prop.area_built}m²` : ''}
${prop.floor ? `- Andar: ${prop.floor}º` : ''}
`;

  if (prop.condominium_fee || prop.iptu) {
    context += `\n## CUSTOS MENSAIS\n`;
    if (prop.condominium_fee) context += `- Condomínio: ${formatPrice(prop.condominium_fee)}/mês\n`;
    if (prop.iptu) context += `- IPTU: ${formatPrice(prop.iptu)}/ano\n`;
  }

  if (prop.address_neighborhood || prop.address_city) {
    context += `\n## LOCALIZAÇÃO\n`;
    const locationParts = [prop.address_neighborhood, prop.address_city, prop.address_state].filter(Boolean);
    context += `- ${locationParts.join(', ')}\n`;
  }

  if (prop.amenities && prop.amenities.length > 0) {
    context += `\n## COMODIDADES E DIFERENCIAIS\n`;
    prop.amenities.forEach(a => context += `- ${a}\n`);
  }

  if (prop.description) {
    context += `\n## DESCRIÇÃO ORIGINAL (use como base, mas reescreva de forma mais persuasiva)\n${prop.description}\n`;
  }

  context += `
## INSTRUÇÕES ADICIONAIS
- Crie uma narrativa envolvente e CONCISA baseada nas características acima
- A descrição deve ter no máximo 180 palavras em 2-3 parágrafos curtos
- Destaque os pontos fortes do imóvel
- Use linguagem que evoque emoções positivas
- Adapte o tom ao perfil do imóvel (se luxo, use tom sofisticado; se familiar, use tom acolhedor)
- O headline deve ser memorável e capturar a essência do imóvel
- Priorize qualidade sobre quantidade nos textos`;

  return context;
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";

// A07: SSRF protection — allowlist of permitted hosts
const ALLOWED_HOSTS = [
  "hlasxwslrkbtryurcaqa.supabase.co",
  "res.cloudinary.com",
];

function isAllowedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    // Block non-https
    if (url.protocol !== "https:") return false;
    // Block private/internal IPs
    const hostname = url.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.") ||
      hostname === "169.254.169.254" || // metadata endpoint
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) return false;
    // Check allowlist
    return ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Encode Uint8Array to base64 in chunks to avoid stack overflow.
 */
function encodeBase64Chunked(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    const chunk = bytes.subarray(i, end);
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

/**
 * Extract hyperlink URIs from raw PDF bytes.
 */
function extractPdfHyperlinks(bytes: Uint8Array): string[] {
  let raw = "";
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    for (let j = i; j < end; j++) {
      raw += String.fromCharCode(bytes[j]);
    }
  }

  const urls = new Set<string>();

  const parenPattern = /\/URI\s*\(([^)]+)\)/gi;
  let match;
  while ((match = parenPattern.exec(raw)) !== null) {
    const url = match[1].trim();
    if (url.startsWith("http")) urls.add(url);
  }

  const hexPattern = /\/URI\s*<([0-9A-Fa-f]+)>/gi;
  while ((match = hexPattern.exec(raw)) !== null) {
    try {
      const hex = match[1];
      let decoded = "";
      for (let i = 0; i < hex.length; i += 2) {
        decoded += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
      }
      if (decoded.startsWith("http")) urls.add(decoded);
    } catch { /* skip malformed */ }
  }

  return Array.from(urls);
}

async function getPdfBytes(req: Request): Promise<{ bytes: Uint8Array; fileName: string }> {
  const contentType = req.headers.get("content-type") || "";
  
  if (contentType.includes("application/json")) {
    const body = await req.json();
    const { storage_url, file_name } = body;
    
    if (!storage_url) throw new Error("storage_url é obrigatório");

    // A07: Validate URL against allowlist
    if (!isAllowedUrl(storage_url)) {
      throw new Error("URL não permitida. Apenas URLs do storage do projeto são aceitas.");
    }
    
    console.log("[extract-pdf] Downloading PDF from allowed storage URL");
    
    // A07: Fetch with timeout and size limit
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    try {
      const pdfResponse = await fetch(storage_url, {
        signal: controller.signal,
        redirect: "error", // Block redirects to prevent SSRF via redirect
      });
      if (!pdfResponse.ok) throw new Error(`Falha ao baixar PDF: ${pdfResponse.status}`);
      
      const arrayBuffer = await pdfResponse.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // 20MB limit
      if (bytes.length > 20 * 1024 * 1024) {
        throw new Error("Arquivo muito grande. Limite: 20MB.");
      }
      
      console.log(`[extract-pdf] Downloaded PDF: ${(bytes.length / 1024 / 1024).toFixed(2)}MB`);
      return { bytes, fileName: file_name || "document.pdf" };
    } finally {
      clearTimeout(timeout);
    }
  }
  
  // FormData with file
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  
  if (!file) throw new Error("Nenhum arquivo enviado");
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Arquivo muito grande para processamento. Limite: 20MB.");
  }
  
  const arrayBuffer = await file.arrayBuffer();
  return { bytes: new Uint8Array(arrayBuffer), fileName: file.name };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { bytes, fileName } = await getPdfBytes(req);

    // Extract hyperlinks from PDF binary BEFORE converting to base64
    const hyperlinks = extractPdfHyperlinks(bytes);
    console.log(`[extract-pdf] Found ${hyperlinks.length} hyperlinks`);

    const photoLinks = hyperlinks.filter(url =>
      url.includes("drive.google.com") ||
      url.includes("docs.google.com") ||
      url.includes("onedrive.live.com") ||
      url.includes("1drv.ms") ||
      url.includes("photos.google.com") ||
      url.includes("dropbox.com")
    );

    const base64 = encodeBase64Chunked(bytes);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const hyperlinksContext = photoLinks.length > 0
      ? `\n\nLINKS DE FOTOS EXTRAÍDOS DO PDF (hiperlinks embutidos):
${photoLinks.map((url, i) => `  ${i + 1}. ${url}`).join("\n")}
IMPORTANTE: Use esses links no campo photos_url de cada imóvel correspondente.`
      : "";

    const systemPrompt = `Você é um especialista em extração de dados imobiliários de documentos PDF.
Analise o conteúdo do documento e extraia TODOS os imóveis listados.

IMPORTANTE:
- O documento pode conter uma TABELA com múltiplos imóveis. Extraia CADA UM separadamente.
- Retorne os dados usando a tool "extract_property_list" fornecida.
- Cada imóvel deve ser um objeto separado no array "properties".

Regras:
- Preços devem ser números (sem R$, pontos ou vírgulas decorativas). Ex: 450000, 2500
- transaction_type: "venda", "aluguel" ou "ambos"
- property_condition: "novo" ou "usado" (se mencionado)
- Amenidades devem ser um array de strings
- Se o dado não estiver no documento, omita o campo (não invente)
- Se o imóvel estiver marcado como "vendido", defina is_sold = true
- Se estiver marcado como "reservado", defina is_reserved = true${hyperlinksContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia TODOS os imóveis deste documento PDF." },
              { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_property_list",
              description: "Extrai dados estruturados de múltiplos imóveis",
              parameters: {
                type: "object",
                properties: {
                  properties: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        unit_identifier: { type: "string" },
                        property_type: { type: "string" },
                        transaction_type: { type: "string", enum: ["venda", "aluguel", "ambos"] },
                        property_condition: { type: "string", enum: ["novo", "usado"] },
                        development_name: { type: "string" },
                        sale_price: { type: "number" },
                        sale_price_financed: { type: "number" },
                        rent_price: { type: "number" },
                        condominium_fee: { type: "number" },
                        iptu: { type: "number" },
                        bedrooms: { type: "integer" },
                        suites: { type: "integer" },
                        bathrooms: { type: "integer" },
                        parking_spots: { type: "integer" },
                        area_total: { type: "number" },
                        area_built: { type: "number" },
                        area_useful: { type: "number" },
                        floor: { type: "integer" },
                        beach_distance_meters: { type: "integer" },
                        address_zipcode: { type: "string" },
                        address_street: { type: "string" },
                        address_number: { type: "string" },
                        address_complement: { type: "string" },
                        address_neighborhood: { type: "string" },
                        address_city: { type: "string" },
                        address_state: { type: "string" },
                        description: { type: "string" },
                        amenities: { type: "array", items: { type: "string" } },
                        owner_name: { type: "string" },
                        owner_phone: { type: "string" },
                        owner_email: { type: "string" },
                        is_sold: { type: "boolean" },
                        is_reserved: { type: "boolean" },
                        photos_url: { type: "string" },
                      },
                      required: ["transaction_type"],
                    },
                  },
                },
                required: ["properties"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_property_list" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("[extract-pdf] AI Gateway error:", response.status);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "extract_property_list") {
      throw new Error("Não foi possível extrair dados do documento");
    }

    const extractedData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[extract-pdf] Error:", error instanceof Error ? error.message : "unknown");
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

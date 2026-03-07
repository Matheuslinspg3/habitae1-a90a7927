import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// A07: SSRF protection — allowlist of permitted hosts
const ALLOWED_HOSTS = [
  "hlasxwslrkbtryurcaqa.supabase.co",
  "res.cloudinary.com",
];

function isAllowedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.") ||
      hostname === "169.254.169.254" ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) return false;
    return ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

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

    if (!isAllowedUrl(storage_url)) {
      throw new Error("URL não permitida. Apenas URLs do storage do projeto são aceitas.");
    }
    
    console.log("[extract-pdf] Downloading PDF from allowed storage URL");
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    try {
      const pdfResponse = await fetch(storage_url, {
        signal: controller.signal,
        redirect: "error",
      });
      if (!pdfResponse.ok) throw new Error(`Falha ao baixar PDF: ${pdfResponse.status}`);
      
      const arrayBuffer = await pdfResponse.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      if (bytes.length > 20 * 1024 * 1024) {
        throw new Error("Arquivo muito grande. Limite: 20MB.");
      }
      
      console.log(`[extract-pdf] Downloaded PDF: ${(bytes.length / 1024 / 1024).toFixed(2)}MB`);
      return { bytes, fileName: file_name || "document.pdf" };
    } finally {
      clearTimeout(timeout);
    }
  }
  
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  
  if (!file) throw new Error("Nenhum arquivo enviado");
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Arquivo muito grande para processamento. Limite: 20MB.");
  }
  
  const arrayBuffer = await file.arrayBuffer();
  return { bytes: new Uint8Array(arrayBuffer), fileName: file.name };
}

// --- Google AI Studio Config (free tier, supports multimodal) ---
const GOOGLE_PDF_KEYS = [
  Deno.env.get("GOOGLE_AI_PDF_KEY_1"),
  Deno.env.get("GOOGLE_AI_PDF_KEY_2"),
].filter(Boolean) as string[];

const GOOGLE_MODEL = "gemini-2.0-flash";
let googleKeyIndex = 0;

function nextGoogleKey(): string | null {
  if (GOOGLE_PDF_KEYS.length === 0) return null;
  const key = GOOGLE_PDF_KEYS[googleKeyIndex % GOOGLE_PDF_KEYS.length];
  googleKeyIndex++;
  return key;
}

const toolDefinition = {
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
  },
};

async function callGoogleAIWithPdf(systemPrompt: string, base64Pdf: string): Promise<any> {
  for (let attempt = 0; attempt < GOOGLE_PDF_KEYS.length; attempt++) {
    const key = nextGoogleKey();
    if (!key) return null;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [
              {
                role: "user",
                parts: [
                  { text: "Extraia TODOS os imóveis deste documento PDF." },
                  {
                    inline_data: {
                      mime_type: "application/pdf",
                      data: base64Pdf,
                    },
                  },
                ],
              },
            ],
            tools: [{ function_declarations: [toolDefinition] }],
            tool_config: {
              function_calling_config: {
                mode: "ANY",
                allowed_function_names: ["extract_property_list"],
              },
            },
            generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
          }),
        }
      );

      if (res.status === 429) {
        console.warn(`Google AI PDF key ${attempt + 1} rate limited, trying next...`);
        continue;
      }
      if (!res.ok) {
        console.error(`Google AI error: ${res.status}`, await res.text());
        continue;
      }

      const data = await res.json();
      
      // Extract function call from Gemini response
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const functionCall = parts.find((p: any) => p.functionCall);
      
      if (functionCall?.functionCall?.args) {
        return { extractedData: functionCall.functionCall.args };
      }
      
      console.error("No function call in Google AI response");
      continue;
    } catch (err) {
      console.error(`Google AI connection error (key ${attempt + 1}):`, err);
    }
  }
  return null;
}

serve(async (req) => {
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

    if (GOOGLE_PDF_KEYS.length === 0) {
      throw new Error("AI not configured (no Google AI keys for PDF extraction)");
    }

    const { bytes, fileName } = await getPdfBytes(req);

    // Extract hyperlinks from PDF binary
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

    const result = await callGoogleAIWithPdf(systemPrompt, base64);

    if (!result) {
      return new Response(
        JSON.stringify({ error: "Todas as chaves de IA estão indisponíveis. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, data: result.extractedData }), {
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

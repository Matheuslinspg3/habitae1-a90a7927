import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUSCA_CRECI_API = "https://api.buscacreci.com.br";

/**
 * Normalize a Brazilian name for comparison.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dice coefficient on bigrams for similarity.
 */
function similarityScore(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;

  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      set.add(s.substring(i, i + 2));
    }
    return set;
  };

  const setA = bigrams(na);
  const setB = bigrams(nb);
  let intersection = 0;
  for (const b of setA) {
    if (setB.has(b)) intersection++;
  }
  return (2 * intersection) / (setA.size + setB.size);
}

/**
 * Format CRECI number for BuscaCRECI API.
 * Expected format: "SP12345F" or with state prefix.
 */
function formatCreciForApi(creciNumber: string, state: string = "SP"): string {
  const clean = creciNumber.replace(/[^0-9A-Za-z]/g, "");
  // Check if it already has state prefix
  const stateMatch = clean.match(/^([A-Za-z]{2})(\d+)([A-Za-z]?)$/);
  if (stateMatch) {
    return `${stateMatch[1].toUpperCase()}${stateMatch[2]}${stateMatch[3].toUpperCase()}`;
  }
  // Extract number and suffix
  const numMatch = clean.match(/^(\d+)([A-Za-z]?)$/);
  if (numMatch) {
    return `${state.toUpperCase()}${numMatch[1]}${numMatch[2].toUpperCase()}`;
  }
  return `${state.toUpperCase()}${clean}`;
}

/**
 * Step 1: Submit CRECI for lookup.
 */
async function submitCreciLookup(creciFormatted: string): Promise<string | null> {
  try {
    const res = await fetch(`${BUSCA_CRECI_API}/?creci=${encodeURIComponent(creciFormatted)}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      console.error("BuscaCRECI submit error:", res.status);
      return null;
    }
    const data = await res.json();
    return data.codigo_solicitacao || null;
  } catch (err) {
    console.error("BuscaCRECI submit exception:", err);
    return null;
  }
}

/**
 * Step 2: Poll status until FINALIZADO or timeout.
 */
async function pollStatus(codigoSolicitacao: string, maxAttempts = 10): Promise<{ creciID: string; creciCompleto: string } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000)); // Wait 2s between polls
    try {
      const res = await fetch(`${BUSCA_CRECI_API}/status?codigo_solicitacao=${encodeURIComponent(codigoSolicitacao)}`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });
      if (!res.ok) continue;
      const data = await res.json();
      console.log(`Poll attempt ${i + 1}:`, data.status);
      if (data.status === "FINALIZADO" && data.creciID) {
        return { creciID: data.creciID, creciCompleto: data.creciCompleto || "" };
      }
      if (data.status === "ERRO" || data.status === "NAO_ENCONTRADO") {
        return null;
      }
    } catch (err) {
      console.error("Poll error:", err);
    }
  }
  return null;
}

/**
 * Step 3: Get CRECI details.
 */
async function getCreciDetails(creciID: string): Promise<{
  nomeCompleto: string;
  situacao: string;
  cidade: string;
  estado: string;
  creciCompleto: string;
} | null> {
  try {
    const res = await fetch(`${BUSCA_CRECI_API}/creci?id=${encodeURIComponent(creciID)}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) {
      console.error("BuscaCRECI details error:", res.status);
      return null;
    }
    const data = await res.json();
    if (!data.nomeCompleto) return null;
    return {
      nomeCompleto: data.nomeCompleto,
      situacao: data.situacao || "Desconhecido",
      cidade: data.cidade || "",
      estado: data.estado || "",
      creciCompleto: data.creciCompleto || "",
    };
  } catch (err) {
    console.error("BuscaCRECI details exception:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user via JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const user = { id: authUser.id };

    const { action, creci_number, user_name, creci_state } = await req.json();

    if (action === "verify-creci") {
      if (!creci_number) {
        return new Response(
          JSON.stringify({ error: "Número do CRECI é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!user_name) {
        return new Response(
          JSON.stringify({ error: "Nome do usuário é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const formatted = formatCreciForApi(creci_number, creci_state || "SP");
      console.log("Querying BuscaCRECI for:", formatted);

      // Step 1: Submit
      const codigoSolicitacao = await submitCreciLookup(formatted);
      if (!codigoSolicitacao) {
        return new Response(
          JSON.stringify({
            verified: false,
            message: "Não foi possível consultar o CRECI no momento. Tente novamente mais tarde.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 2: Poll status
      const statusResult = await pollStatus(codigoSolicitacao);
      if (!statusResult) {
        return new Response(
          JSON.stringify({
            verified: false,
            message: "CRECI não encontrado no registro público. Verifique o número e o estado informado.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 3: Get details
      const details = await getCreciDetails(statusResult.creciID);
      if (!details) {
        return new Response(
          JSON.stringify({
            verified: false,
            message: "CRECI encontrado mas não foi possível obter os detalhes. Tente novamente.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Compare names
      const score = similarityScore(user_name, details.nomeCompleto);
      const isMatch = score >= 0.6;

      if (isMatch && details.situacao !== "Cancelado") {
        // Update profile as verified
        await supabase
          .from("profiles")
          .update({
            creci_verified: true,
            creci_verified_at: new Date().toISOString(),
            creci_verified_name: details.nomeCompleto,
          })
          .eq("user_id", user.id);

        return new Response(
          JSON.stringify({
            verified: true,
            registered_name: details.nomeCompleto,
            status: details.situacao,
            creci_completo: details.creciCompleto,
            similarity: Math.round(score * 100),
            message: `CRECI verificado com sucesso! Nome registrado: ${details.nomeCompleto} (${details.situacao})`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (details.situacao === "Cancelado") {
        return new Response(
          JSON.stringify({
            verified: false,
            registered_name: details.nomeCompleto,
            status: details.situacao,
            creci_completo: details.creciCompleto,
            message: "Este CRECI está com status Cancelado no registro do conselho.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({
            verified: false,
            registered_name: details.nomeCompleto,
            similarity: Math.round(score * 100),
            status: details.situacao,
            creci_completo: details.creciCompleto,
            message: `O nome informado não corresponde ao registrado no CRECI. Nome registrado: ${details.nomeCompleto}`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in verify-creci:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

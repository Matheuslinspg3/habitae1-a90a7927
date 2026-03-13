import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUSCA_CRECI_API = "https://api.buscacreci.com.br";
const N8N_WEBHOOK_URL = "https://n8n.costazul.shop/webhook/verify-creci";
const MAX_POLL_ATTEMPTS = 12;
const POLL_INTERVAL_MS = 3000;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarityScore(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;
  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.substring(i, i + 2));
    return set;
  };
  const setA = bigrams(na);
  const setB = bigrams(nb);
  let intersection = 0;
  for (const b of setA) if (setB.has(b)) intersection++;
  return (2 * intersection) / (setA.size + setB.size);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Strategy 1: BuscaCRECI free API (async 3-step)
async function consultarViaBuscaCRECI(creciNumber: string, state: string): Promise<any> {
  // Try with F (pessoa física) suffix first
  const suffixes = ["F", "J"];
  for (const suffix of suffixes) {
    const creciFormatted = `${state}${creciNumber}${suffix}`;
    console.log(`[verify-creci] BuscaCRECI: tentando ${creciFormatted}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const submitRes = await fetch(
        `${BUSCA_CRECI_API}/?creci=${encodeURIComponent(creciFormatted)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!submitRes.ok) {
        const body = await submitRes.text();
        console.log(`[verify-creci] BuscaCRECI submit error: ${submitRes.status} ${body}`);
        throw new Error(`BuscaCRECI indisponível (${submitRes.status})`);
      }

      const submitData = await submitRes.json();
      const codigoSolicitacao = submitData.codigo_solicitacao;
      if (!codigoSolicitacao) throw new Error("Código de solicitação não retornado");

      // Poll for result
      let creciId: string | null = null;
      let creciCompleto = "";

      for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
        await sleep(POLL_INTERVAL_MS);
        try {
          const statusRes = await fetch(
            `${BUSCA_CRECI_API}/status?codigo_solicitacao=${codigoSolicitacao}`
          );
          if (!statusRes.ok) { await statusRes.text(); continue; }

          const statusData = await statusRes.json();
          console.log(`[verify-creci] Poll ${i + 1}: ${statusData.status}`);

          if (statusData.status === "FINALIZADO" && statusData.creciID) {
            creciId = statusData.creciID;
            creciCompleto = statusData.creciCompleto || "";
            break;
          }
          if (statusData.status === "ERRO") {
            throw new Error(statusData.mensagem || "Erro na consulta");
          }
        } catch (pollErr: any) {
          if (pollErr.message?.includes("Erro na consulta")) throw pollErr;
          console.log(`[verify-creci] Poll error: ${pollErr.message}`);
          continue;
        }
      }

      if (!creciId) throw new Error("Tempo esgotado aguardando resultado");

      // Get details
      const detailRes = await fetch(`${BUSCA_CRECI_API}/creci?id=${creciId}`);
      if (!detailRes.ok) { await detailRes.text(); throw new Error("Falha ao buscar detalhes"); }
      const detailData = await detailRes.json();

      if (detailData.nomeCompleto) {
        return {
          found: true,
          nomeCompleto: detailData.nomeCompleto,
          situacao: detailData.situacao || "",
          cidade: detailData.cidade || "",
          estado: detailData.estado || "",
          creciCompleto: detailData.creciCompleto || creciCompleto,
          source: "buscacreci",
        };
      }
    } catch (err: any) {
      clearTimeout(timeout);
      console.log(`[verify-creci] BuscaCRECI falhou para ${suffix}: ${err.message}`);
      // If API is down (not just wrong suffix), throw to trigger fallback
      if (err.message?.includes("indisponível") || err.name === "AbortError") {
        throw err;
      }
      continue; // Try next suffix
    }
  }

  throw new Error("CRECI não encontrado via BuscaCRECI");
}

// Strategy 2: n8n webhook fallback
async function consultarViaN8N(
  creciNumber: string,
  state: string,
  userName: string,
  userId: string,
  orgId: string | null,
  orgName: string,
): Promise<any> {
  console.log(`[verify-creci] Fallback n8n: ${creciNumber} ${state}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const n8nRes = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creci_number: creciNumber,
        creci_state: state,
        user_name: userName,
        user_id: userId,
        organization_id: orgId,
        organization_name: orgName,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const n8nText = await n8nRes.text();
    console.log(`[verify-creci] n8n response: ${n8nRes.status} ${n8nText}`);

    if (!n8nRes.ok || !n8nText) {
      throw new Error(`n8n indisponível (${n8nRes.status})`);
    }

    const n8nData = JSON.parse(n8nText);
    return {
      found: !!n8nData.found && !!n8nData.nomeCompleto,
      nomeCompleto: n8nData.nomeCompleto || "",
      situacao: n8nData.situacao || "",
      cidade: n8nData.cidade || "",
      estado: n8nData.estado || "",
      creciCompleto: n8nData.creciCompleto || "",
      source: "n8n",
    };
  } catch (err: any) {
    clearTimeout(timeout);
    throw new Error(`Fallback n8n falhou: ${err.message}`);
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

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, organization_id")
      .eq("user_id", authUser.id)
      .single();

    let orgName = "";
    if (profile?.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", profile.organization_id)
        .single();
      orgName = org?.name || "";
    }

    const { action, creci_number, user_name, creci_state } = await req.json();

    if (action !== "verify-creci") {
      return new Response(
        JSON.stringify({ error: "Ação inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!creci_number || !user_name) {
      return new Response(
        JSON.stringify({ error: "Número do CRECI e nome são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const state = creci_state || "SP";
    const nameToCheck = profile?.full_name || user_name;

    // Try BuscaCRECI first, fallback to n8n
    let creciData: any;
    try {
      creciData = await consultarViaBuscaCRECI(creci_number, state);
    } catch (buscaErr: any) {
      console.log(`[verify-creci] BuscaCRECI indisponível, tentando n8n: ${buscaErr.message}`);
      try {
        creciData = await consultarViaN8N(
          creci_number, state, nameToCheck, authUser.id,
          profile?.organization_id || null, orgName,
        );
      } catch (n8nErr: any) {
        console.error(`[verify-creci] Ambos falharam: ${n8nErr.message}`);
        return new Response(
          JSON.stringify({
            verified: false,
            message: "Não foi possível consultar o CRECI no momento. Ambos os serviços estão indisponíveis. Tente novamente mais tarde.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!creciData.found || !creciData.nomeCompleto) {
      return new Response(
        JSON.stringify({
          verified: false,
          message: "CRECI não encontrado no registro público. Verifique o número e o estado informado.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const score = similarityScore(nameToCheck, creciData.nomeCompleto);
    const isMatch = score >= 0.6;
    const isCancelled = ["Cancelado", "Inativo"].includes(creciData.situacao);

    if (isMatch && !isCancelled) {
      await supabase
        .from("profiles")
        .update({
          creci_verified: true,
          creci_verified_at: new Date().toISOString(),
          creci_verified_name: creciData.nomeCompleto,
        })
        .eq("user_id", authUser.id);

      return new Response(
        JSON.stringify({
          verified: true,
          registered_name: creciData.nomeCompleto,
          status: creciData.situacao,
          creci_completo: creciData.creciCompleto,
          similarity: Math.round(score * 100),
          message: `CRECI verificado com sucesso! Nome registrado: ${creciData.nomeCompleto} (${creciData.situacao})`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (isCancelled) {
      return new Response(
        JSON.stringify({
          verified: false,
          registered_name: creciData.nomeCompleto,
          status: creciData.situacao,
          creci_completo: creciData.creciCompleto,
          message: `Este CRECI está com status "${creciData.situacao}" no registro do conselho.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          verified: false,
          registered_name: creciData.nomeCompleto,
          similarity: Math.round(score * 100),
          status: creciData.situacao,
          creci_completo: creciData.creciCompleto,
          message: `O nome informado não corresponde ao registrado no CRECI. Nome registrado: ${creciData.nomeCompleto}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error in verify-creci:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

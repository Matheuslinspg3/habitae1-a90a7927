import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUSCA_CRECI_API = "https://api.buscacreci.com.br";
const MAX_POLL_ATTEMPTS = 15;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function consultarCRECI(creciNumber: string, state: string): Promise<any> {
  const creciFormatted = `${state}${creciNumber}F`;
  console.log(`[verify-creci] Consultando CRECI: ${creciFormatted}`);

  // Step 1: Submit query
  const submitRes = await fetch(`${BUSCA_CRECI_API}/?creci=${encodeURIComponent(creciFormatted)}`);
  const submitText = await submitRes.text();
  console.log(`[verify-creci] Submit response: ${submitRes.status} ${submitText}`);

  if (!submitRes.ok || !submitText) {
    throw new Error(`Falha ao enviar consulta: status ${submitRes.status}`);
  }

  let submitData: any;
  try {
    submitData = JSON.parse(submitText);
  } catch {
    throw new Error("Resposta inválida do serviço de consulta");
  }

  const codigoSolicitacao = submitData.codigo_solicitacao;
  if (!codigoSolicitacao) {
    throw new Error("Código de solicitação não retornado");
  }

  // Step 2: Poll for result
  let creciId: string | null = null;
  let creciCompleto = "";

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS);

    const statusRes = await fetch(
      `${BUSCA_CRECI_API}/status?codigo_solicitacao=${codigoSolicitacao}`
    );
    const statusText = await statusRes.text();
    console.log(`[verify-creci] Poll ${i + 1}: ${statusText}`);

    if (!statusRes.ok || !statusText) continue;

    let statusData: any;
    try {
      statusData = JSON.parse(statusText);
    } catch {
      continue;
    }

    if (statusData.status === "FINALIZADO" && statusData.creciID) {
      creciId = statusData.creciID;
      creciCompleto = statusData.creciCompleto || "";
      break;
    }

    if (statusData.status === "ERRO") {
      throw new Error(statusData.mensagem || "Erro na consulta do CRECI");
    }
  }

  if (!creciId) {
    throw new Error("Tempo esgotado aguardando resultado da consulta");
  }

  // Step 3: Get details
  const detailRes = await fetch(`${BUSCA_CRECI_API}/creci?id=${creciId}`);
  const detailText = await detailRes.text();
  console.log(`[verify-creci] Detail response: ${detailText}`);

  if (!detailRes.ok || !detailText) {
    throw new Error("Falha ao buscar detalhes do CRECI");
  }

  let detailData: any;
  try {
    detailData = JSON.parse(detailText);
  } catch {
    throw new Error("Resposta de detalhes inválida");
  }

  return {
    found: !!detailData.nomeCompleto,
    nomeCompleto: detailData.nomeCompleto || "",
    situacao: detailData.situacao || "",
    cidade: detailData.cidade || "",
    estado: detailData.estado || "",
    creciCompleto: detailData.creciCompleto || creciCompleto,
  };
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

    const { action, creci_number, user_name, creci_state } = await req.json();

    if (action !== "verify-creci") {
      return new Response(
        JSON.stringify({ error: "Ação inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const state = creci_state || "SP";
    const nameToCheck = profile?.full_name || user_name;

    let creciData: any;
    try {
      creciData = await consultarCRECI(creci_number, state);
    } catch (err: any) {
      console.error("[verify-creci] Consulta falhou:", err.message);
      return new Response(
        JSON.stringify({
          verified: false,
          message: err.message || "Não foi possível consultar o CRECI no momento. Tente novamente mais tarde.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    if (isMatch && creciData.situacao !== "Cancelado" && creciData.situacao !== "Inativo") {
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
    } else if (creciData.situacao === "Cancelado" || creciData.situacao === "Inativo") {
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

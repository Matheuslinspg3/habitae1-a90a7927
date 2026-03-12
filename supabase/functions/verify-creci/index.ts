import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const N8N_WEBHOOK_URL = "https://n8n.costazul.shop/webhook/verify-creci";

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

      // Send payload to n8n webhook
      const n8nPayload = {
        creci_number,
        creci_state: creci_state || "SP",
        user_name: profile?.full_name || user_name,
        user_id: authUser.id,
        organization_id: profile?.organization_id || null,
        organization_name: orgName,
      };

      console.log("Sending to n8n:", JSON.stringify(n8nPayload));

      const n8nRes = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(n8nPayload),
      });

      const n8nText = await n8nRes.text();
      console.log("n8n raw response:", n8nRes.status, n8nText);

      if (!n8nRes.ok || !n8nText) {
        console.error("n8n webhook error:", n8nRes.status);
        return new Response(
          JSON.stringify({
            verified: false,
            message: "Não foi possível consultar o CRECI no momento. Tente novamente mais tarde.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let n8nData: any;
      try {
        n8nData = JSON.parse(n8nText);
      } catch {
        console.error("n8n returned invalid JSON:", n8nText);
        return new Response(
          JSON.stringify({
            verified: false,
            message: "Resposta inválida do serviço de verificação. Configure o webhook n8n para retornar JSON.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // n8n returns: { found, nomeCompleto, situacao, cidade, estado, creciCompleto }
      if (!n8nData.found || !n8nData.nomeCompleto) {
        return new Response(
          JSON.stringify({
            verified: false,
            message: "CRECI não encontrado no registro público. Verifique o número e o estado informado.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const score = similarityScore(user_name, n8nData.nomeCompleto);
      const isMatch = score >= 0.6;

      if (isMatch && n8nData.situacao !== "Cancelado") {
        await supabase
          .from("profiles")
          .update({
            creci_verified: true,
            creci_verified_at: new Date().toISOString(),
            creci_verified_name: n8nData.nomeCompleto,
          })
          .eq("user_id", authUser.id);

        return new Response(
          JSON.stringify({
            verified: true,
            registered_name: n8nData.nomeCompleto,
            status: n8nData.situacao,
            creci_completo: n8nData.creciCompleto || "",
            similarity: Math.round(score * 100),
            message: `CRECI verificado com sucesso! Nome registrado: ${n8nData.nomeCompleto} (${n8nData.situacao})`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (n8nData.situacao === "Cancelado") {
        return new Response(
          JSON.stringify({
            verified: false,
            registered_name: n8nData.nomeCompleto,
            status: n8nData.situacao,
            creci_completo: n8nData.creciCompleto || "",
            message: "Este CRECI está com status Cancelado no registro do conselho.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({
            verified: false,
            registered_name: n8nData.nomeCompleto,
            similarity: Math.round(score * 100),
            status: n8nData.situacao,
            creci_completo: n8nData.creciCompleto || "",
            message: `O nome informado não corresponde ao registrado no CRECI. Nome registrado: ${n8nData.nomeCompleto}`,
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

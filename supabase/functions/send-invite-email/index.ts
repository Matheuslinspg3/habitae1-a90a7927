import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGO_URL = "https://portadocorretor.com.br/email/porta-logo.png";

function platformEmailHtml(inviteLink: string) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#D62828,#F77F00);padding:32px;text-align:center;">
    <img src="${LOGO_URL}" alt="Porta do Corretor" width="180" style="display:block;margin:0 auto 12px;" />
    <p style="color:#FFF3E0;margin:0;font-size:14px;">Plataforma Imobiliária</p>
  </td></tr>
  <tr><td style="padding:32px;">
    <h2 style="color:#1f2937;margin:0 0 8px;font-size:24px;">🚪 A Porta do Corretor se abriu para você!</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 16px;">
      Você foi selecionado para se cadastrar na <strong>Porta do Corretor</strong>, a plataforma completa para gestão imobiliária.
    </p>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;">
      🎁 Você terá <strong>7 dias gratuitos</strong> para testar todas as funcionalidades!
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="${inviteLink}" style="display:inline-block;background:linear-gradient(135deg,#D62828,#F77F00);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:16px;">
          Criar minha conta
        </a>
      </td></tr>
    </table>
    <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;text-align:center;">
      Este convite expira em 7 dias. Se o botão não funcionar, copie e cole este link no navegador:<br>
      <a href="${inviteLink}" style="color:#D62828;word-break:break-all;">${inviteLink}</a>
    </p>
  </td></tr>
  <tr><td style="background:#FFF8F0;padding:16px;text-align:center;border-top:2px solid #FCBF49;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">© Porta do Corretor — Plataforma Imobiliária</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function teamEmailHtml(inviteLink: string, orgName: string, orgCode: string) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#D62828,#F77F00);padding:32px;text-align:center;">
    <img src="${LOGO_URL}" alt="Porta do Corretor" width="180" style="display:block;margin:0 auto 12px;" />
    <p style="color:#FFF3E0;margin:0;font-size:14px;">Plataforma Imobiliária</p>
  </td></tr>
  <tr><td style="padding:32px;">
    <h2 style="color:#1f2937;margin:0 0 8px;font-size:24px;">🚪 A Porta do Corretor se abriu para você!</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 16px;">
      Você foi convidado para fazer parte da equipe da <strong>${orgName}</strong> na Porta do Corretor.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr><td style="background:#FFF8F0;border:2px dashed #F77F00;border-radius:10px;padding:16px;text-align:center;">
        <p style="color:#6b7280;font-size:12px;margin:0 0 4px;">Código da Imobiliária</p>
        <p style="color:#D62828;font-size:28px;font-weight:bold;letter-spacing:6px;margin:0;">${orgCode}</p>
        <p style="color:#9ca3af;font-size:11px;margin:4px 0 0;">Use este código ao se cadastrar</p>
      </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="${inviteLink}" style="display:inline-block;background:linear-gradient(135deg,#D62828,#F77F00);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:16px;">
          Aceitar convite
        </a>
      </td></tr>
    </table>
    <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;text-align:center;">
      Este convite expira em 7 dias. Se o botão não funcionar, copie e cole este link no navegador:<br>
      <a href="${inviteLink}" style="color:#D62828;word-break:break-all;">${inviteLink}</a>
    </p>
  </td></tr>
  <tr><td style="background:#FFF8F0;padding:16px;text-align:center;border-top:2px solid #FCBF49;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">© Porta do Corretor — Plataforma Imobiliária</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, type, invite_link, org_name, org_code, inviter_name } = await req.json();

    if (!to || !type || !invite_link) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: to, type, invite_link" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let subject: string;
    let html: string;

    if (type === "team") {
      if (!org_name || !org_code) {
        return new Response(
          JSON.stringify({ error: "org_name e org_code são obrigatórios para convites de equipe" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      subject = `A Porta do Corretor se abriu para você — ${org_name}`;
      html = teamEmailHtml(invite_link, org_name, org_code);
    } else {
      subject = "🚪 A Porta do Corretor se abriu para você!";
      html = platformEmailHtml(invite_link);
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Porta do Corretor <noreply@portadocorretor.com.br>",
        to: [to],
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      return new Response(
        JSON.stringify({ error: "Falha ao enviar email", details: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, id: resendData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

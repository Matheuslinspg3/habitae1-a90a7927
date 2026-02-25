import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGO_URL = "https://portadocorretor.com.br/email/porta-logo.png";

function resetEmailHtml(resetLink: string) {
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
    <h2 style="color:#1f2937;margin:0 0 8px;font-size:24px;">🔑 Redefinição de Senha</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 16px;">
      Você solicitou a redefinição da sua senha na <strong>Porta do Corretor</strong>.
    </p>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;">
      Clique no botão abaixo para criar uma nova senha. Este link é válido por <strong>1 hora</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#D62828,#F77F00);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:16px;">
          Redefinir minha senha
        </a>
      </td></tr>
    </table>
    <p style="color:#6b7280;font-size:13px;margin:24px 0 0;line-height:1.5;">
      ⚠️ Se você não solicitou esta redefinição, ignore este email. Sua senha permanecerá inalterada.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin:16px 0 0;text-align:center;">
      Se o botão não funcionar, copie e cole este link no navegador:<br>
      <a href="${resetLink}" style="color:#D62828;word-break:break-all;">${resetLink}</a>
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
    const { email, redirect_to } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to generate the reset link
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email.trim().toLowerCase(),
      options: {
        redirectTo: redirect_to || "https://portadocorretor.com.br/auth",
      },
    });

    if (linkError) {
      console.error("Generate link error:", linkError);
      // Don't reveal if user exists or not
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The generated link contains the token - extract and build proper URL
    const resetLink = linkData?.properties?.action_link;
    if (!resetLink) {
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Porta do Corretor <noreply@portadocorretor.com.br>",
        to: [email.trim().toLowerCase()],
        subject: "🔑 Redefinição de Senha — Porta do Corretor",
        html: resetEmailHtml(resetLink),
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

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

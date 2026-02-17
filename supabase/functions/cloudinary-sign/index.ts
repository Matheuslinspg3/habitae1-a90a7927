import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

async function sha1(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace('Bearer ', '');
    const { data, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = data.claims.sub;

    const body = await req.json().catch(() => ({}));
    const folder = body.folder || 'properties';
    const fileHash = body.file_hash || '';

    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: 'Credenciais não configuradas' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const timestamp = Math.floor(Date.now() / 1000);

    // Incoming transformation: normaliza o MASTER antes de armazenar
    // c_limit,w_2048,h_2048 → redimensiona para max 2048px no maior lado
    // q_auto:good → compressão automática com boa qualidade
    // fl_strip_profile → remove EXIF/ICC/metadata
    const incomingTransformation = 'c_limit,w_2048,h_2048/q_auto:good/fl_strip_profile';

    const params: Record<string, string | number> = {
      folder,
      overwrite: 'false',
      timestamp,
      transformation: incomingTransformation,
      unique_filename: fileHash ? 'false' : 'true',
    };

    // Se temos hash do arquivo, usar como public_id para dedupe natural
    // Com public_id fixo + overwrite:false, Cloudinary retorna o existente
    if (fileHash) {
      params.public_id = `${folder}/${fileHash}`;
    }

    // Assinar (ordem alfabética, conforme exigido pela Cloudinary)
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const signature = await sha1(sortedParams + apiSecret);

    console.log(`[SIGN] user=${userId} folder=${folder} hash=${fileHash ? fileHash.slice(0, 8) + '...' : 'none'} transform=incoming`);

    return new Response(JSON.stringify({
      signature,
      timestamp,
      api_key: apiKey,
      cloud_name: cloudName,
      folder,
      overwrite: false,
      transformation: incomingTransformation,
      unique_filename: !fileHash,
      ...(fileHash ? { public_id: `${folder}/${fileHash}` } : {}),
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[SIGN] Erro:', error);
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

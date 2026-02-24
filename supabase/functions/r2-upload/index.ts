import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// ── AWS SigV4 with Web Crypto ──

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(data: BufferSource): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', data));
}

async function hmac(key: ArrayBuffer, msg: string): Promise<ArrayBuffer> {
  const ck = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', ck, new TextEncoder().encode(msg));
}

async function signingKey(secret: string, date: string, region: string, service: string) {
  let k: ArrayBuffer = await hmac(new TextEncoder().encode('AWS4' + secret).buffer, date);
  k = await hmac(k, region);
  k = await hmac(k, service);
  k = await hmac(k, 'aws4_request');
  return k;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // File
    const fd = await req.formData();
    const file = fd.get('file') as File | null;
    const folder = (fd.get('folder') as string) || 'properties';
    if (!file) return new Response(JSON.stringify({ error: 'Nenhum arquivo' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!file.type.startsWith('image/')) return new Response(JSON.stringify({ error: 'Apenas imagens' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (file.size > 10 * 1024 * 1024) return new Response(JSON.stringify({ error: 'Arquivo > 10MB' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // TRIM all credentials to remove hidden whitespace/newlines
    const accessKey = (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim();
    const secretKey = (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim();
    const endpoint = (Deno.env.get('R2_ENDPOINT') ?? '').trim().replace(/\/$/, '');
    const bucket = (Deno.env.get('R2_BUCKET_NAME') ?? '').trim();
    const publicUrl = (Deno.env.get('R2_PUBLIC_URL') ?? '').trim();

    if (!accessKey || !secretKey || !endpoint || !bucket) {
      return new Response(JSON.stringify({ error: 'R2 config incompleta' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const objectKey = `${folder}/${crypto.randomUUID()}.${ext}`;
    const body = new Uint8Array(await file.arrayBuffer());

    const host = new URL(endpoint).host;
    const canonicalUri = `/${bucket}/${objectKey}`;
    const url = `${endpoint}${canonicalUri}`;

    // Timestamps
    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dateStamp = amzDate.slice(0, 8);

    // Payload hash
    const payloadHash = await sha256Hex(body);

    // Canonical request
    const canonicalHeaders =
      `content-type:${file.type}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest =
      'PUT\n' +
      canonicalUri + '\n' +
      '\n' +
      canonicalHeaders + '\n' +
      signedHeaders + '\n' +
      payloadHash;

    // String to sign
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const canonicalRequestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));
    const stringToSign =
      'AWS4-HMAC-SHA256\n' +
      amzDate + '\n' +
      credentialScope + '\n' +
      canonicalRequestHash;

    // Signature
    const sk = await signingKey(secretKey, dateStamp, 'auto', 's3');
    const signature = toHex(await hmac(sk, stringToSign));

    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    console.log(`[r2-upload] PUT ${objectKey} (${body.length}B)`);

    const r2 = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        Authorization: authorization,
      },
      body,
    });

    if (!r2.ok) {
      const err = await r2.text();
      console.error(`R2 ${r2.status}: ${err}`);
      return new Response(JSON.stringify({ error: 'Falha no upload para R2', details: err }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // publicUrl should be the R2 public bucket URL (e.g. https://pub-xxx.r2.dev or custom domain)
    // If not set or same as S3 endpoint, fall back to the full upload URL
    let fileUrl: string;
    if (publicUrl && !publicUrl.includes('r2.cloudflarestorage.com')) {
      fileUrl = `${publicUrl.replace(/\/$/, '')}/${objectKey}`;
    } else {
      // Use the S3 upload URL directly (includes bucket in path)
      fileUrl = url;
    }
    console.log(`R2 OK: ${fileUrl}`);

    return new Response(JSON.stringify({
      url: fileUrl, key: objectKey, storage_provider: 'r2', size: file.size, content_type: file.type,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('Upload error:', e);
    return new Response(JSON.stringify({ error: 'Erro interno', message: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

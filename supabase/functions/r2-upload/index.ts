import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

async function putObjectToR2(
  body: Uint8Array,
  objectKey: string,
  contentType: string,
  env: { accessKey: string; secretKey: string; endpoint: string; bucket: string },
): Promise<void> {
  const host = new URL(env.endpoint).host;
  const canonicalUri = `/${env.bucket}/${objectKey}`;
  const url = `${env.endpoint}${canonicalUri}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256Hex(body);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest =
    'PUT\n' + canonicalUri + '\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + payloadHash;

  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalRequestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));
  const stringToSign = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' + canonicalRequestHash;

  const sk = await signingKey(env.secretKey, dateStamp, 'auto', 's3');
  const signature = toHex(await hmac(sk, stringToSign));
  const authorization = `AWS4-HMAC-SHA256 Credential=${env.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const r2 = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    },
    body,
  });

  if (!r2.ok) {
    const err = await r2.text();
    throw new Error(`R2 PUT ${r2.status}: ${err}`);
  }
}

Deno.serve(async (req) => {
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

    // R2 env
    const accessKey = (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim();
    const secretKey = (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim();
    const endpoint = (Deno.env.get('R2_ENDPOINT') ?? '').trim().replace(/\/$/, '');
    const bucket = (Deno.env.get('R2_BUCKET_NAME') ?? '').trim();
    const publicUrl = (Deno.env.get('R2_PUBLIC_URL') ?? '').trim().replace(/\/$/, '');

    if (!accessKey || !secretKey || !endpoint || !bucket) {
      return new Response(JSON.stringify({ error: 'R2 config incompleta' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const r2Env = { accessKey, secretKey, endpoint, bucket };

    // Parse FormData
    const fd = await req.formData();

    // ── Two-variant mode: full + thumb ──
    const fullFile = fd.get('full') as File | null;
    const thumbFile = fd.get('thumb') as File | null;
    const propertyId = (fd.get('propertyId') as string) || crypto.randomUUID();

    if (fullFile && thumbFile) {
      // Validate
      if (fullFile.size > 10 * 1024 * 1024 || thumbFile.size > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'Arquivo muito grande' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const uploadId = crypto.randomUUID();
      const r2KeyFull = `imoveis/${propertyId}/${uploadId}_full.webp`;
      const r2KeyThumb = `imoveis/${propertyId}/${uploadId}_thumb.webp`;

      const fullBody = new Uint8Array(await fullFile.arrayBuffer());
      const thumbBody = new Uint8Array(await thumbFile.arrayBuffer());

      console.log(`[r2-upload] Uploading full (${fullBody.length}B) + thumb (${thumbBody.length}B) for property ${propertyId}`);

      // Upload both in parallel
      await Promise.all([
        putObjectToR2(fullBody, r2KeyFull, 'image/webp', r2Env),
        putObjectToR2(thumbBody, r2KeyThumb, 'image/webp', r2Env),
      ]);

      const base = publicUrl && !publicUrl.includes('r2.cloudflarestorage.com') ? publicUrl : endpoint;
      const publicUrlFull = publicUrl && !publicUrl.includes('r2.cloudflarestorage.com')
        ? `${publicUrl}/${r2KeyFull}`
        : `${endpoint}/${bucket}/${r2KeyFull}`;
      const publicUrlThumb = publicUrl && !publicUrl.includes('r2.cloudflarestorage.com')
        ? `${publicUrl}/${r2KeyThumb}`
        : `${endpoint}/${bucket}/${r2KeyThumb}`;

      console.log(`[r2-upload] OK: ${r2KeyFull}`);

      return new Response(JSON.stringify({
        uploadId,
        r2KeyFull,
        r2KeyThumb,
        publicUrlFull,
        publicUrlThumb,
        storage_provider: 'r2',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Legacy single-file mode ──
    const file = fd.get('file') as File | null;
    const folder = (fd.get('folder') as string) || 'properties';
    if (!file) return new Response(JSON.stringify({ error: 'Nenhum arquivo' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!file.type.startsWith('image/')) return new Response(JSON.stringify({ error: 'Apenas imagens' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (file.size > 10 * 1024 * 1024) return new Response(JSON.stringify({ error: 'Arquivo > 10MB' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const ext = file.name.split('.').pop() || 'jpg';
    const objectKey = `${folder}/${crypto.randomUUID()}.${ext}`;
    const body = new Uint8Array(await file.arrayBuffer());

    console.log(`[r2-upload] PUT ${objectKey} (${body.length}B)`);
    await putObjectToR2(body, objectKey, file.type, r2Env);

    let fileUrl: string;
    if (publicUrl && !publicUrl.includes('r2.cloudflarestorage.com')) {
      fileUrl = `${publicUrl}/${objectKey}`;
    } else {
      fileUrl = `${endpoint}/${bucket}/${objectKey}`;
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

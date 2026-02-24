import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const PRESIGN_EXPIRY = 600; // 10 minutes

// ── AWS SigV4 helpers ──

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

/**
 * Generate a presigned PUT URL for R2/S3.
 */
async function generatePresignedPutUrl(
  objectKey: string,
  contentType: string,
  accessKey: string,
  secretKey: string,
  endpoint: string,
  bucket: string,
  expirySeconds: number,
): Promise<string> {
  const host = new URL(endpoint).host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const credential = `${accessKey}/${credentialScope}`;

  const canonicalUri = `/${bucket}/${objectKey}`;

  // Query parameters for presigned URL
  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expirySeconds),
    'X-Amz-SignedHeaders': 'content-type;host',
  });
  queryParams.sort();
  const canonicalQueryString = queryParams.toString();

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';

  const canonicalRequest =
    'PUT\n' +
    canonicalUri + '\n' +
    canonicalQueryString + '\n' +
    canonicalHeaders + '\n' +
    signedHeaders + '\n' +
    'UNSIGNED-PAYLOAD';

  const canonicalRequestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));
  const stringToSign =
    'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' + canonicalRequestHash;

  const sk = await signingKey(secretKey, dateStamp, 'auto', 's3');
  const signature = toHex(await hmac(sk, stringToSign));

  return `${endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Auth ──
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse body ──
    const body = await req.json();
    const { propertyId, files } = body as {
      propertyId: string;
      files: Array<{ mimeType: string; sizeBytes: number }>;
    };

    if (!propertyId || !files || !Array.isArray(files) || files.length === 0) {
      return new Response(JSON.stringify({ error: 'propertyId e files são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (files.length > 50) {
      return new Response(JSON.stringify({ error: 'Máximo de 50 arquivos por request' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Validate user can edit this property (skip for temp uploads of new properties) ──
    const { data: property } = await supabase
      .from('properties')
      .select('id, organization_id')
      .eq('id', propertyId)
      .single();

    // If property doesn't exist, verify user belongs to an org (temp upload for new property)
    if (!property) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) {
        return new Response(JSON.stringify({ error: 'Usuário sem organização' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Validate each file ──
    for (const f of files) {
      if (!ALLOWED_MIMES.includes(f.mimeType)) {
        return new Response(JSON.stringify({
          error: `Tipo não permitido: ${f.mimeType}. Permitidos: ${ALLOWED_MIMES.join(', ')}`,
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (f.sizeBytes > MAX_FILE_SIZE) {
        return new Response(JSON.stringify({
          error: `Arquivo excede 5MB (${(f.sizeBytes / 1024 / 1024).toFixed(1)}MB)`,
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── R2 config ──
    const accessKey = (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim();
    const secretKey = (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim();
    const endpoint = (Deno.env.get('R2_ENDPOINT') ?? '').trim().replace(/\/$/, '');
    const bucket = (Deno.env.get('R2_BUCKET_NAME') ?? '').trim();
    const publicUrl = (Deno.env.get('R2_PUBLIC_URL') ?? '').trim().replace(/\/$/, '');

    if (!accessKey || !secretKey || !endpoint || !bucket) {
      return new Response(JSON.stringify({ error: 'Configuração R2 incompleta' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Generate presigned URLs for each file (thumb + full) ──
    const results = [];
    const contentType = 'image/webp'; // All variants are webp

    for (const _f of files) {
      const uploadId = crypto.randomUUID();
      const keyFull = `imoveis/${propertyId}/${uploadId}_full.webp`;
      const keyThumb = `imoveis/${propertyId}/${uploadId}_thumb.webp`;

      const [presignedFull, presignedThumb] = await Promise.all([
        generatePresignedPutUrl(keyFull, contentType, accessKey, secretKey, endpoint, bucket, PRESIGN_EXPIRY),
        generatePresignedPutUrl(keyThumb, contentType, accessKey, secretKey, endpoint, bucket, PRESIGN_EXPIRY),
      ]);

      // Compute public URLs
      let publicBase = publicUrl;
      if (!publicBase || publicBase.includes('r2.cloudflarestorage.com')) {
        publicBase = `${endpoint}/${bucket}`;
      }

      results.push({
        uploadId,
        r2KeyFull: keyFull,
        r2KeyThumb: keyThumb,
        presignedPutUrlFull: presignedFull,
        presignedPutUrlThumb: presignedThumb,
        publicUrlFull: `${publicBase}/${keyFull}`,
        publicUrlThumb: `${publicBase}/${keyThumb}`,
        requiredHeaders: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });

      console.log(`[r2-presign] Generated URLs for ${uploadId} (property: ${propertyId})`);
    }

    return new Response(JSON.stringify({ uploads: results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('Presign error:', e);
    return new Response(JSON.stringify({ error: 'Erro interno', message: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

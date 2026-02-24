import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function putObjectToR2(
  aws: AwsClient,
  body: Uint8Array,
  objectKey: string,
  contentType: string,
  endpoint: string,
  bucket: string,
): Promise<void> {
  const url = `${endpoint}/${bucket}/${objectKey}`;

  const res = await aws.fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`R2 PUT ${res.status}: ${err}`);
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

    console.log(`[r2-upload] endpoint=${endpoint}, bucket=${bucket}, accessKey=${accessKey.slice(0, 6)}...`);

    const aws = new AwsClient({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      region: 'auto',
      service: 's3',
    });

    // Parse FormData
    const fd = await req.formData();

    // ── Two-variant mode: full + thumb ──
    const fullFile = fd.get('full') as File | null;
    const thumbFile = fd.get('thumb') as File | null;
    const propertyId = (fd.get('propertyId') as string) || crypto.randomUUID();

    if (fullFile && thumbFile) {
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

      await Promise.all([
        putObjectToR2(aws, fullBody, r2KeyFull, 'image/webp', endpoint, bucket),
        putObjectToR2(aws, thumbBody, r2KeyThumb, 'image/webp', endpoint, bucket),
      ]);

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
    await putObjectToR2(aws, body, objectKey, file.type, endpoint, bucket);

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

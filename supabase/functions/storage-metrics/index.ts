import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── R2 S3 ListObjectsV2 with SigV4 ──

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

async function signedR2Request(method: string, path: string, query: string, endpoint: string, accessKey: string, secretKey: string): Promise<Response> {
  const host = new URL(endpoint).host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256Hex(new Uint8Array(0));

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest =
    `${method}\n${path}\n${query}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalRequestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

  const sk = await signingKey(secretKey, dateStamp, 'auto', 's3');
  const signature = toHex(await hmac(sk, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `${endpoint}${path}${query ? '?' + query : ''}`;
  return fetch(url, {
    method,
    headers: {
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    },
  });
}

interface R2Stats {
  totalObjects: number;
  totalBytes: number;
  byFolder: Record<string, { count: number; bytes: number }>;
}

async function getR2Stats(endpoint: string, bucket: string, accessKey: string, secretKey: string): Promise<R2Stats> {
  const stats: R2Stats = { totalObjects: 0, totalBytes: 0, byFolder: {} };
  let continuationToken = '';
  let hasMore = true;

  while (hasMore) {
    let query = 'list-type=2&max-keys=1000';
    if (continuationToken) {
      query += `&continuation-token=${encodeURIComponent(continuationToken)}`;
    }

    const res = await signedR2Request('GET', `/${bucket}`, query, endpoint, accessKey, secretKey);
    if (!res.ok) {
      const text = await res.text();
      console.error(`R2 ListObjects error: ${res.status} ${text}`);
      throw new Error(`R2 ListObjects failed: ${res.status}`);
    }

    const xml = await res.text();

    const keyRegex = /<Key>([^<]+)<\/Key>/g;
    const sizeRegex = /<Size>(\d+)<\/Size>/g;
    const truncatedMatch = xml.match(/<IsTruncated>(true|false)<\/IsTruncated>/);
    const nextTokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);

    let keyMatch;
    let sizeMatch;
    while ((keyMatch = keyRegex.exec(xml)) !== null && (sizeMatch = sizeRegex.exec(xml)) !== null) {
      const key = keyMatch[1];
      const size = parseInt(sizeMatch[1], 10);

      stats.totalObjects++;
      stats.totalBytes += size;

      const folder = key.split('/')[0] || 'root';
      if (!stats.byFolder[folder]) {
        stats.byFolder[folder] = { count: 0, bytes: 0 };
      }
      stats.byFolder[folder].count++;
      stats.byFolder[folder].bytes += size;
    }

    hasMore = truncatedMatch?.[1] === 'true';
    continuationToken = nextTokenMatch?.[1] || '';
  }

  return stats;
}

interface CloudinaryStats {
  storage_used_bytes: number;
  bandwidth_used_bytes: number;
  total_resources: number;
  credits_used: number;
  credits_limit: number;
  plan: string;
}

async function getCloudinaryStats(cloudName: string, apiKey: string, apiSecret: string): Promise<CloudinaryStats> {
  const auth = btoa(`${apiKey}:${apiSecret}`);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/usage`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Cloudinary usage error: ${res.status} ${text}`);
    throw new Error(`Cloudinary usage API failed: ${res.status}`);
  }

  const data = await res.json();

  return {
    storage_used_bytes: data.storage?.usage || 0,
    bandwidth_used_bytes: data.bandwidth?.usage || 0,
    total_resources: data.resources || 0,
    credits_used: data.credits?.usage || 0,
    credits_limit: data.credits?.limit || 0,
    plan: data.plan || 'unknown',
  };
}

function buildCloudinaryResponse(stats: CloudinaryStats | null, hasConfig: boolean, error: string | null) {
  if (stats) {
    return {
      configured: true,
      storage_used_bytes: stats.storage_used_bytes,
      bandwidth_used_bytes: stats.bandwidth_used_bytes,
      total_resources: stats.total_resources,
      credits_used: stats.credits_used,
      credits_limit: stats.credits_limit,
      plan: stats.plan,
      free_limit_bytes: 25 * 1024 * 1024 * 1024,
    };
  }
  return { configured: hasConfig, error };
}

Deno.serve(async (req) => {
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
    const user = { id: claimsData.claims.sub as string };

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isDev = roles?.some(r => r.role === 'developer');
    if (!isDev) {
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // R2 config
    const r2Endpoint = (Deno.env.get('R2_ENDPOINT') ?? '').trim().replace(/\/$/, '');
    const r2Bucket = (Deno.env.get('R2_BUCKET_NAME') ?? '').trim();
    const r2AccessKey = (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim();
    const r2SecretKey = (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim();
    const hasR2 = !!(r2Endpoint && r2Bucket && r2AccessKey && r2SecretKey);

    // Cloudinary 1 config
    const cloudName1 = (Deno.env.get('CLOUDINARY_CLOUD_NAME') ?? '').trim();
    const cloudApiKey1 = (Deno.env.get('CLOUDINARY_API_KEY') ?? '').trim();
    const cloudApiSecret1 = (Deno.env.get('CLOUDINARY_API_SECRET') ?? '').trim();
    const hasCloud1 = !!(cloudName1 && cloudApiKey1 && cloudApiSecret1);

    // Cloudinary 2 config
    const cloudName2 = (Deno.env.get('CLOUDINARY2_CLOUD_NAME') ?? '').trim();
    const cloudApiKey2 = (Deno.env.get('CLOUDINARY2_API_KEY') ?? '').trim();
    const cloudApiSecret2 = (Deno.env.get('CLOUDINARY2_API_SECRET') ?? '').trim();
    const hasCloud2 = !!(cloudName2 && cloudApiKey2 && cloudApiSecret2);

    const [r2Result, cloud1Result, cloud2Result] = await Promise.allSettled([
      hasR2 ? getR2Stats(r2Endpoint, r2Bucket, r2AccessKey, r2SecretKey) : Promise.resolve(null),
      hasCloud1 ? getCloudinaryStats(cloudName1, cloudApiKey1, cloudApiSecret1) : Promise.resolve(null),
      hasCloud2 ? getCloudinaryStats(cloudName2, cloudApiKey2, cloudApiSecret2) : Promise.resolve(null),
    ]);

    const r2 = r2Result.status === 'fulfilled' ? r2Result.value : null;
    const cloud1 = cloud1Result.status === 'fulfilled' ? cloud1Result.value : null;
    const cloud2 = cloud2Result.status === 'fulfilled' ? cloud2Result.value : null;

    if (r2Result.status === 'rejected') console.error('R2 error:', r2Result.reason);
    if (cloud1Result.status === 'rejected') console.error('Cloudinary 1 error:', cloud1Result.reason);
    if (cloud2Result.status === 'rejected') console.error('Cloudinary 2 error:', cloud2Result.reason);

    return new Response(JSON.stringify({
      r2: r2 ? {
        configured: true,
        total_objects: r2.totalObjects,
        total_bytes: r2.totalBytes,
        by_folder: r2.byFolder,
        free_limit_bytes: 10 * 1024 * 1024 * 1024,
      } : { configured: hasR2, error: r2Result.status === 'rejected' ? String(r2Result.reason) : null },
      cloudinary: buildCloudinaryResponse(
        cloud1,
        hasCloud1,
        cloud1Result.status === 'rejected' ? String(cloud1Result.reason) : null,
      ),
      cloudinary2: buildCloudinaryResponse(
        cloud2,
        hasCloud2,
        cloud2Result.status === 'rejected' ? String(cloud2Result.reason) : null,
      ),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('storage-metrics error:', e);
    return new Response(JSON.stringify({ error: 'Erro interno', message: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

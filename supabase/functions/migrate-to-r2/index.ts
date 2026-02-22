import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BATCH_SIZE = 20;

// ── AWS SigV4 helpers (same as r2-presign) ──

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(data: BufferSource): Promise<string> {
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
  objectKey: string,
  body: Uint8Array,
  contentType: string,
  accessKey: string,
  secretKey: string,
  endpoint: string,
  bucket: string,
): Promise<boolean> {
  const host = new URL(endpoint).host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;

  const canonicalUri = `/${bucket}/${objectKey}`;
  const payloadHash = await sha256(body);

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const canonicalRequestHash = await sha256(new TextEncoder().encode(canonicalRequest));
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`;

  const sk = await signingKey(secretKey, dateStamp, 'auto', 's3');
  const signature = toHex(await hmac(sk, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`${endpoint}${canonicalUri}`, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'Authorization': authorization,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    body,
  });

  return res.ok;
}

/**
 * Download an image and resize it to a target width.
 * Uses simple fetch + no Canvas (edge runtime).
 * Since we can't use Canvas in Deno, we upload the original as-is.
 * The client already does WebP conversion for new uploads.
 */
async function downloadImage(url: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const data = new Uint8Array(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return { data, contentType };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Auth: service role or authenticated user
  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get user's org
  const { data: profile } = await supabaseUser
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  if (!profile?.organization_id) {
    return new Response(JSON.stringify({ error: 'No organization' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Parse body for optional limit
  let limit = BATCH_SIZE;
  try {
    const body = await req.json();
    if (body?.limit) limit = Math.min(body.limit, 100);
  } catch { /* empty body ok */ }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // R2 config
  const accessKey = (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim();
  const secretKey = (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim();
  const endpoint = (Deno.env.get('R2_ENDPOINT') ?? '').trim().replace(/\/$/, '');
  const bucket = (Deno.env.get('R2_BUCKET_NAME') ?? '').trim();
  const publicUrl = (Deno.env.get('R2_PUBLIC_URL') ?? '').trim().replace(/\/$/, '');

  if (!accessKey || !secretKey || !endpoint || !bucket) {
    return new Response(JSON.stringify({ error: 'R2 not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const publicBase = publicUrl || `${endpoint}/${bucket}`;

  console.log(`[MIGRATE] Starting migration for org ${profile.organization_id}, batch ${limit}`);

  // Fetch Cloudinary images that haven't been migrated yet
  const { data: images, error: fetchErr } = await supabaseAdmin
    .from('property_images')
    .select('id, url, property_id, cached_thumbnail_url')
    .eq('storage_provider', 'cloudinary')
    .in('property_id', 
      supabaseAdmin
        .from('properties')
        .select('id')
        .eq('organization_id', profile.organization_id)
        .limit(5000) as any
    )
    .limit(limit);

  // Fallback: query with join
  let imagesToMigrate = images;
  if (fetchErr || !images) {
    const { data: fallbackImages } = await supabaseAdmin
      .rpc('get_cloudinary_images_for_migration' as any, {
        p_org_id: profile.organization_id,
        p_limit: limit,
      });
    imagesToMigrate = fallbackImages;
  }

  if (!imagesToMigrate || imagesToMigrate.length === 0) {
    return new Response(JSON.stringify({ 
      success: true, migrated: 0, failed: 0, remaining: 0,
      message: 'No Cloudinary images to migrate' 
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let migrated = 0;
  let failed = 0;

  for (const img of imagesToMigrate) {
    try {
      const imageUrl = img.url;
      if (!imageUrl) { failed++; continue; }

      // Download original
      const downloaded = await downloadImage(imageUrl);
      if (!downloaded) {
        console.warn(`[MIGRATE] Failed to download: ${imageUrl}`);
        failed++;
        continue;
      }

      const uploadId = crypto.randomUUID();
      const ext = downloaded.contentType.includes('webp') ? 'webp' : 
                  downloaded.contentType.includes('png') ? 'png' : 'jpg';
      const keyFull = `imoveis/${img.property_id}/${uploadId}_full.${ext}`;
      const keyThumb = `imoveis/${img.property_id}/${uploadId}_thumb.${ext}`;

      // Upload full to R2
      const fullOk = await putObjectToR2(keyFull, downloaded.data, downloaded.contentType, accessKey, secretKey, endpoint, bucket);
      if (!fullOk) {
        console.warn(`[MIGRATE] R2 PUT failed for ${keyFull}`);
        failed++;
        continue;
      }

      // For thumb, try downloading Cloudinary thumb or use same image
      let thumbData = downloaded;
      if (img.cached_thumbnail_url) {
        const thumbDownloaded = await downloadImage(img.cached_thumbnail_url);
        if (thumbDownloaded) thumbData = thumbDownloaded;
      }

      const thumbOk = await putObjectToR2(keyThumb, thumbData.data, thumbData.contentType, accessKey, secretKey, endpoint, bucket);
      if (!thumbOk) {
        console.warn(`[MIGRATE] R2 thumb PUT failed for ${keyThumb}`);
        // Full was uploaded, still update record
      }

      // Update DB record
      const { error: updateErr } = await supabaseAdmin
        .from('property_images')
        .update({
          storage_provider: 'r2',
          r2_key_full: keyFull,
          r2_key_thumb: thumbOk ? keyThumb : null,
          url: `${publicBase}/${keyFull}`,
        })
        .eq('id', img.id);

      if (updateErr) {
        console.error(`[MIGRATE] DB update failed for ${img.id}:`, updateErr);
        failed++;
      } else {
        migrated++;
        console.log(`[MIGRATE] OK: ${img.id} → ${keyFull}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.error(`[MIGRATE] Error for ${img.id}:`, e);
      failed++;
    }
  }

  // Count remaining
  const { count: remaining } = await supabaseAdmin
    .from('property_images')
    .select('id', { count: 'exact', head: true })
    .eq('storage_provider', 'cloudinary');

  const summary = { success: true, migrated, failed, remaining: remaining ?? 0 };
  console.log(`[MIGRATE] Done:`, summary);

  return new Response(JSON.stringify(summary), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

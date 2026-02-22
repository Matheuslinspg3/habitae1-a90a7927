import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Process up to 500 items per invocation, using Cloudinary bulk delete (100 per API call)
const BATCH_SIZE = 500;
const CLOUDINARY_BULK_LIMIT = 100;
const RETENTION_HOURS = 24;

interface DeletedMedia {
  id: string;
  cloudinary_public_id: string | null;
  cloudinary_url: string;
  storage_path: string | null;
  r2_key_full?: string | null;
  r2_key_thumb?: string | null;
  storage_provider?: string | null;
}

function extractPublicIdFromUrl(url: string): string | null {
  if (!url || !url.includes('cloudinary.com')) return null;
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z]+)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function bulkDeleteFromCloudinary(publicIds: string[]): Promise<{ deleted: string[]; failed: string[] }> {
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !apiSecret) {
    console.error('[CLEANUP] Cloudinary credentials not configured');
    return { deleted: [], failed: publicIds };
  }

  const deleted: string[] = [];
  const failed: string[] = [];

  // Cloudinary allows up to 100 public_ids per delete_resources call
  for (let i = 0; i < publicIds.length; i += CLOUDINARY_BULK_LIMIT) {
    const chunk = publicIds.slice(i, i + CLOUDINARY_BULK_LIMIT);

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const publicIdsParam = chunk.join(',');
      const signatureString = `public_ids[]=${chunk.join('&public_ids[]=')}&timestamp=${timestamp}${apiSecret}`;

      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-1', encoder.encode(signatureString));
      const signature = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const formData = new FormData();
      for (const pid of chunk) {
        formData.append('public_ids[]', pid);
      }
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp.toString());
      formData.append('signature', signature);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`,
        { method: 'DELETE', body: formData }
      );

      if (!response.ok) {
        // Fallback: try individual deletes for this chunk
        console.warn(`[CLEANUP] Bulk delete API returned ${response.status}, falling back to individual deletes`);
        for (const pid of chunk) {
          const ok = await singleDeleteFromCloudinary(pid, cloudName, apiKey, apiSecret);
          if (ok) deleted.push(pid); else failed.push(pid);
          await new Promise(r => setTimeout(r, 50));
        }
        continue;
      }

      const result = await response.json();
      console.log(`[CLEANUP] Bulk delete result: ${JSON.stringify(result).substring(0, 300)}`);

      // Process result
      if (result.deleted) {
        for (const [pid, status] of Object.entries(result.deleted)) {
          if (status === 'deleted' || status === 'not_found') {
            deleted.push(pid);
          } else {
            failed.push(pid);
          }
        }
      } else {
        // If response format unexpected, mark all as deleted (best effort)
        deleted.push(...chunk);
      }
    } catch (error) {
      console.error(`[CLEANUP] Bulk delete error:`, error);
      failed.push(...chunk);
    }

    // Small delay between bulk calls
    await new Promise(r => setTimeout(r, 200));
  }

  return { deleted, failed };
}

async function singleDeleteFromCloudinary(publicId: string, cloudName: string, apiKey: string, apiSecret: string): Promise<boolean> {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureString = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-1', encoder.encode(signatureString));
    const signature = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) return false;
    const result = await response.json();
    return result.result === 'ok' || result.result === 'not found';
  } catch {
    return false;
  }
}

// ── R2 Delete ──

async function deleteFromR2(keys: string[]): Promise<{ deleted: string[]; failed: string[] }> {
  const accessKey = (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim();
  const secretKey = (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim();
  const endpoint = (Deno.env.get('R2_ENDPOINT') ?? '').trim().replace(/\/$/, '');
  const bucket = (Deno.env.get('R2_BUCKET_NAME') ?? '').trim();

  if (!accessKey || !secretKey || !endpoint || !bucket) {
    console.warn('[CLEANUP] R2 credentials not configured');
    return { deleted: [], failed: keys };
  }

  const deleted: string[] = [];
  const failed: string[] = [];
  const host = new URL(endpoint).host;

  for (const key of keys) {
    try {
      const now = new Date();
      const amzDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const dateStamp = amzDate.slice(0, 8);
      const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
      const canonicalUri = `/${bucket}/${key}`;

      const payloadHash = Array.from(new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(''))
      )).map(b => b.toString(16).padStart(2, '0')).join('');

      const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
      const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
      const canonicalRequest = `DELETE\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

      const crHash = Array.from(new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest))
      )).map(b => b.toString(16).padStart(2, '0')).join('');

      const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crHash}`;

      // Signing key
      const enc = new TextEncoder();
      let sk: ArrayBuffer = await crypto.subtle.sign('HMAC',
        await crypto.subtle.importKey('raw', enc.encode('AWS4' + secretKey).buffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
        enc.encode(dateStamp));
      sk = await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', sk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode('auto'));
      sk = await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', sk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode('s3'));
      sk = await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', sk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode('aws4_request'));

      const signature = Array.from(new Uint8Array(
        await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', sk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode(stringToSign))
      )).map(b => b.toString(16).padStart(2, '0')).join('');

      const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

      const res = await fetch(`${endpoint}${canonicalUri}`, {
        method: 'DELETE',
        headers: {
          'x-amz-content-sha256': payloadHash,
          'x-amz-date': amzDate,
          'Authorization': authorization,
        },
      });

      if (res.ok || res.status === 404) {
        deleted.push(key);
      } else {
        console.warn(`[CLEANUP] R2 DELETE ${key} returned ${res.status}`);
        failed.push(key);
      }
    } catch (e) {
      console.error(`[CLEANUP] R2 DELETE error for ${key}:`, e);
      failed.push(key);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  return { deleted, failed };
}

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const token = authHeader.replace('Bearer ', '');
  const isServiceRole = token === supabaseServiceKey;
  const isCronCall = token === supabaseAnonKey; // Cron uses anon key

  if (!isServiceRole && !isCronCall) {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const userToken = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(userToken);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`[CLEANUP] Triggered by user ${claimsData.claims.sub}`);
  } else {
    console.log(`[CLEANUP] Triggered via ${isServiceRole ? 'service role' : 'cron'}`);
  }

  const startTime = Date.now();
  console.log('[CLEANUP] Starting orphan media cleanup job');

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - RETENTION_HOURS);

    // Fetch pending media
    const { data: pendingMedia, error: fetchError } = await supabaseAdmin
      .from('deleted_property_media')
      .select('id, cloudinary_public_id, cloudinary_url, storage_path')
      .lt('deleted_at', cutoffTime.toISOString())
      .is('cleaned_at', null)
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('[CLEANUP] Error fetching pending media:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending media' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingMedia || pendingMedia.length === 0) {
      console.log('[CLEANUP] No pending media to clean');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending media', processed: 0, duration_ms: Date.now() - startTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CLEANUP] Found ${pendingMedia.length} items to clean`);

    // Separate by provider
    const cloudinaryItems: { id: string; publicId: string }[] = [];
    const r2Items: { id: string; keys: string[] }[] = [];
    const nonCloudinaryIds: string[] = [];

    for (const media of pendingMedia as DeletedMedia[]) {
      // Check R2 keys first
      if (media.r2_key_full || media.r2_key_thumb) {
        const keys: string[] = [];
        if (media.r2_key_full) keys.push(media.r2_key_full);
        if (media.r2_key_thumb) keys.push(media.r2_key_thumb);
        r2Items.push({ id: media.id, keys });
        continue;
      }

      const publicId = media.cloudinary_public_id || extractPublicIdFromUrl(media.cloudinary_url);
      if (!publicId || !media.cloudinary_url.includes('cloudinary.com')) {
        nonCloudinaryIds.push(media.id);
      } else {
        cloudinaryItems.push({ id: media.id, publicId });
      }
    }

    // Mark non-cloud as cleaned immediately
    if (nonCloudinaryIds.length > 0) {
      await supabaseAdmin
        .from('deleted_property_media')
        .update({ cleaned_at: new Date().toISOString(), cleanup_error: 'Not a cloud URL' })
        .in('id', nonCloudinaryIds);
      console.log(`[CLEANUP] Marked ${nonCloudinaryIds.length} non-cloud items as cleaned`);
    }

    // Bulk delete from Cloudinary
    let deleted = 0;
    let failed = 0;

    if (cloudinaryItems.length > 0) {
      const publicIds = cloudinaryItems.map(i => i.publicId);
      const result = await bulkDeleteFromCloudinary(publicIds);

      // Map results back to DB records
      const deletedSet = new Set(result.deleted);
      const successIds: string[] = [];
      const failIds: string[] = [];

      for (const item of cloudinaryItems) {
        if (deletedSet.has(item.publicId)) {
          successIds.push(item.id);
        } else {
          failIds.push(item.id);
        }
      }

      if (successIds.length > 0) {
        await supabaseAdmin
          .from('deleted_property_media')
          .update({ cleaned_at: new Date().toISOString() })
          .in('id', successIds);
      }

      if (failIds.length > 0) {
        await supabaseAdmin
          .from('deleted_property_media')
          .update({ cleanup_error: 'Cloudinary deletion failed' })
          .in('id', failIds);
      }

      deleted = successIds.length;
      failed = failIds.length;
    }

    // ── R2 cleanup ──
    let r2Deleted = 0;
    let r2Failed = 0;

    if (r2Items.length > 0) {
      const allKeys = r2Items.flatMap(i => i.keys);
      const r2Result = await deleteFromR2(allKeys);
      const deletedKeySet = new Set(r2Result.deleted);

      const r2SuccessIds: string[] = [];
      const r2FailIds: string[] = [];

      for (const item of r2Items) {
        const allDeleted = item.keys.every(k => deletedKeySet.has(k));
        if (allDeleted) {
          r2SuccessIds.push(item.id);
        } else {
          r2FailIds.push(item.id);
        }
      }

      if (r2SuccessIds.length > 0) {
        await supabaseAdmin
          .from('deleted_property_media')
          .update({ cleaned_at: new Date().toISOString() })
          .in('id', r2SuccessIds);
      }

      if (r2FailIds.length > 0) {
        await supabaseAdmin
          .from('deleted_property_media')
          .update({ cleanup_error: 'R2 deletion failed' })
          .in('id', r2FailIds);
      }

      r2Deleted = r2SuccessIds.length;
      r2Failed = r2FailIds.length;
    }

    const duration = Date.now() - startTime;
    const summary = {
      success: true,
      processed: pendingMedia.length,
      cloudinary_deleted: deleted,
      cloudinary_failed: failed,
      r2_deleted: r2Deleted,
      r2_failed: r2Failed,
      non_cloud_skipped: nonCloudinaryIds.length,
      duration_ms: duration,
    };
    console.log(`[CLEANUP] Completed:`, summary);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[CLEANUP] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Cleanup job failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

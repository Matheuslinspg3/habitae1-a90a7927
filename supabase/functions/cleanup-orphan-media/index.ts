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

Deno.serve(async (req) => {
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

    // Separate Cloudinary from non-Cloudinary URLs
    const cloudinaryItems: { id: string; publicId: string }[] = [];
    const nonCloudinaryIds: string[] = [];

    for (const media of pendingMedia as DeletedMedia[]) {
      const publicId = media.cloudinary_public_id || extractPublicIdFromUrl(media.cloudinary_url);

      if (!publicId || !media.cloudinary_url.includes('cloudinary.com')) {
        nonCloudinaryIds.push(media.id);
      } else {
        cloudinaryItems.push({ id: media.id, publicId });
      }
    }

    // Mark non-Cloudinary as cleaned immediately
    if (nonCloudinaryIds.length > 0) {
      await supabaseAdmin
        .from('deleted_property_media')
        .update({ cleaned_at: new Date().toISOString(), cleanup_error: 'Not a Cloudinary URL' })
        .in('id', nonCloudinaryIds);
      console.log(`[CLEANUP] Marked ${nonCloudinaryIds.length} non-Cloudinary items as cleaned`);
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

    const duration = Date.now() - startTime;
    const summary = {
      success: true,
      processed: pendingMedia.length,
      cloudinary_deleted: deleted,
      cloudinary_failed: failed,
      non_cloudinary_skipped: nonCloudinaryIds.length,
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

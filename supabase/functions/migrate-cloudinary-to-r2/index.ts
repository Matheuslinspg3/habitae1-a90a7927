/**
 * migrate-cloudinary-to-r2
 * 
 * Batch migrates property images from Cloudinary to R2.
 * Resilient: per-image try/catch, timeout per download, retries, dead-image marking.
 * 
 * POST body: { batchSize?: number, dryRun?: boolean }
 * Returns: { migrated, failed, skipped, remaining, errors[], elapsed_ms }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_FUNCTION_TIME_MS = 45_000; // leave 15s buffer before 60s timeout
const DOWNLOAD_TIMEOUT_MS = 8_000;   // 8s per image download
const MAX_RETRIES = 1;

async function putObjectToR2(
  aws: AwsClient, body: Uint8Array, key: string, ct: string, endpoint: string, bucket: string,
): Promise<void> {
  const url = `${endpoint}/${bucket}/${key}`;
  const res = await aws.fetch(url, { method: "PUT", headers: { "Content-Type": ct }, body });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`R2 PUT ${res.status}: ${err.substring(0, 200)}`);
  }
}

async function downloadWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MigrationBot/1.0)", Accept: "image/*,*/*;q=0.8" },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function downloadImage(url: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    const resp = await downloadWithTimeout(url, DOWNLOAD_TIMEOUT_MS);
    
    // 401/403 = account blocked, fail immediately
    if (resp.status === 401 || resp.status === 403) {
      await resp.body?.cancel();
      console.log(`[migrate] 401/403 for: ${url.substring(0, 60)}...`);
      return null;
    }
    
    if (!resp.ok) {
      await resp.body?.cancel();
      return null;
    }

    const ct = resp.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/") && ct !== "application/octet-stream") {
      await resp.body?.cancel();
      return null;
    }
    
    const buf = new Uint8Array(await resp.arrayBuffer());
    if (buf.length < 100) return null;
    return { data: buf, contentType: ct.startsWith("image/") ? ct : "image/jpeg" };
  } catch (e) {
    console.warn(`[migrate] Download error: ${e.name} - ${url.substring(0, 60)}`);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id)
      .in("role", ["admin", "developer"]);
    if (!roles?.length) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse params ──
    let batchSize = 10;
    let dryRun = false;
    let propertyIds: string[] | null = null;
    try {
      const body = await req.json();
      batchSize = Math.min(Math.max(body.batchSize || 10, 1), 50);
      dryRun = body.dryRun === true;
      if (Array.isArray(body.propertyIds) && body.propertyIds.length > 0) {
        propertyIds = body.propertyIds;
      }
    } catch { /* defaults */ }

    // ── R2 config ──
    const accessKey = (Deno.env.get("R2_ACCESS_KEY_ID") ?? "").trim();
    const secretKey = (Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "").trim();
    const endpoint = (Deno.env.get("R2_ENDPOINT") ?? "").trim().replace(/\/$/, "");
    const bucket = (Deno.env.get("R2_BUCKET_NAME") ?? "").trim();
    const publicUrl = (Deno.env.get("R2_PUBLIC_URL") ?? "").trim().replace(/\/$/, "");

    if (!accessKey || !secretKey || !endpoint || !bucket) {
      return new Response(JSON.stringify({ error: "R2 config incompleta" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aws = new AwsClient({ accessKeyId: accessKey, secretAccessKey: secretKey, region: "auto", service: "s3" });

    // ── Get images needing migration ──
    let query = supabaseAdmin
      .from("property_images")
      .select("id, url, property_id, cached_thumbnail_url, storage_provider")
      .eq("storage_provider", "cloudinary")
      .is("r2_key_full", null)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (propertyIds) {
      query = query.in("property_id", propertyIds);
    }

    const { data: images, error: fetchErr } = await query;

    console.log(`[migrate] Query returned ${images?.length ?? 0} images, error: ${fetchErr?.message ?? 'none'}`);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Count total remaining ──
    let countQuery = supabaseAdmin
      .from("property_images")
      .select("id", { count: "exact", head: true })
      .eq("storage_provider", "cloudinary")
      .is("r2_key_full", null);

    if (propertyIds) {
      countQuery = countQuery.in("property_id", propertyIds);
    }

    const { count: totalRemaining } = await countQuery;

    if (!images?.length) {
      return new Response(JSON.stringify({
        migrated: 0, failed: 0, skipped: 0, remaining: totalRemaining || 0,
        errors: [], message: totalRemaining ? `0 processadas neste lote. ${totalRemaining} pendentes.` : "✅ Migração concluída!",
        elapsed_ms: Date.now() - startTime,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (dryRun) {
      return new Response(JSON.stringify({
        dryRun: true, wouldMigrate: images.length, remaining: totalRemaining || 0,
        sampleUrls: images.slice(0, 3).map(i => i.url),
        elapsed_ms: Date.now() - startTime,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Process images ──
    let migrated = 0, failed = 0, skipped = 0;
    const errors: string[] = [];
    console.log(`[migrate] Starting loop for ${images.length} images, time elapsed: ${Date.now() - startTime}ms`);

    for (const img of images) {
      // Time guard: stop if approaching timeout
      if (Date.now() - startTime > MAX_FUNCTION_TIME_MS) {
        console.warn("[migrate] Approaching timeout, stopping batch early");
        break;
      }

      try {
        const propertyId = img.property_id || "orphan";
        const uploadId = crypto.randomUUID();

        // Skip if URL is empty or already dead
        if (!img.url || img.storage_provider === "cloudinary_dead") {
          skipped++;
          continue;
        }

        // Download from Cloudinary
        const downloaded = await downloadImage(img.url);
        if (!downloaded) {
          // Mark as dead so we don't retry forever
          await supabaseAdmin
            .from("property_images")
            .update({ storage_provider: "cloudinary_dead" } as any)
            .eq("id", img.id);
          failed++;
          errors.push(`${img.id}: download falhou`);
          continue;
        }

        // Determine extension
        const ext = downloaded.contentType.includes("png") ? "png"
          : downloaded.contentType.includes("webp") ? "webp" : "jpg";
        const r2Key = `imoveis/${propertyId}/${uploadId}_full.${ext}`;

        // Upload to R2
        await putObjectToR2(aws, downloaded.data, r2Key, downloaded.contentType, endpoint, bucket);

        // Build public URL
        const newUrl = publicUrl && !publicUrl.includes("r2.cloudflarestorage.com")
          ? `${publicUrl}/${r2Key}` : `${endpoint}/${bucket}/${r2Key}`;

        // Update DB
        await supabaseAdmin
          .from("property_images")
          .update({ url: newUrl, r2_key_full: r2Key, storage_provider: "r2" } as any)
          .eq("id", img.id);

        migrated++;
        console.log(`[migrate] ✓ ${img.id} → ${r2Key} (${(downloaded.data.length / 1024).toFixed(0)}KB)`);
      } catch (e) {
        failed++;
        errors.push(`${img.id}: ${e.message?.substring(0, 100)}`);
        console.error(`[migrate] ✗ ${img.id}:`, e.message);
      }
    }

    const remaining = Math.max(0, (totalRemaining || 0) - migrated);
    const elapsed = Date.now() - startTime;

    return new Response(JSON.stringify({
      migrated, failed, skipped, remaining,
      errors: errors.slice(0, 20),
      elapsed_ms: elapsed,
      message: remaining > 0
        ? `Migradas ${migrated} imagens. Restam ~${remaining}. Execute novamente.`
        : `✅ Migração concluída! ${migrated} imagens migradas.`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[migrate] Fatal:", error);
    return new Response(JSON.stringify({
      error: "Erro interno", message: error.message,
      elapsed_ms: Date.now() - startTime,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

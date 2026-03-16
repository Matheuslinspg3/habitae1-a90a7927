/**
 * migrate-cloudinary-to-r2
 * 
 * Batch migrates property images from Cloudinary to R2.
 * Processes in batches of 10 to avoid timeouts.
 * 
 * POST /migrate-cloudinary-to-r2
 * Body: { batchSize?: number, dryRun?: boolean }
 * 
 * Returns: { migrated, failed, remaining, errors[] }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`R2 PUT ${res.status}: ${err}`);
  }
}

async function downloadImage(url: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MigrationBot/1.0)",
        Accept: "image/*,*/*;q=0.8",
      },
    });
    if (!resp.ok) {
      // Try without transformations
      const cleanUrl = url.replace(/\/image\/upload\/[^/]*\//, "/image/upload/");
      if (cleanUrl !== url) {
        const resp2 = await fetch(cleanUrl, {
          headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" },
        });
        if (resp2.ok) {
          const ct = resp2.headers.get("content-type") || "image/jpeg";
          const buf = new Uint8Array(await resp2.arrayBuffer());
          return { data: buf, contentType: ct };
        }
      }
      return null;
    }
    const ct = resp.headers.get("content-type") || "image/jpeg";
    const buf = new Uint8Array(await resp.arrayBuffer());
    return { data: buf, contentType: ct };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth - require service role or authenticated admin
    const authHeader = req.headers.get("Authorization");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Verify caller is admin
    if (authHeader) {
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
      // Check admin role
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "developer"]);
      if (!roles || roles.length === 0) {
        return new Response(JSON.stringify({ error: "Sem permissão" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse params
    let batchSize = 10;
    let dryRun = false;
    try {
      const body = await req.json();
      batchSize = Math.min(body.batchSize || 10, 50);
      dryRun = body.dryRun === true;
    } catch { /* default values */ }

    // R2 config
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

    const aws = new AwsClient({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      region: "auto",
      service: "s3",
    });

    // Get images that need migration (cloudinary or null provider, with cloudinary URL)
    const { data: images, error: fetchError } = await supabaseAdmin
      .from("property_images")
      .select("id, url, property_id, cached_thumbnail_url, storage_provider")
      .or("storage_provider.eq.cloudinary,storage_provider.is.null")
      .like("url", "%res.cloudinary.com%")
      .is("r2_key_full", null)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Count remaining
    const { count: totalRemaining } = await supabaseAdmin
      .from("property_images")
      .select("id", { count: "exact", head: true })
      .or("storage_provider.eq.cloudinary,storage_provider.is.null")
      .like("url", "%res.cloudinary.com%")
      .is("r2_key_full", null);

    if (!images || images.length === 0) {
      return new Response(JSON.stringify({
        migrated: 0, failed: 0, remaining: 0, errors: [], message: "Nenhuma imagem para migrar",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (dryRun) {
      return new Response(JSON.stringify({
        dryRun: true,
        wouldMigrate: images.length,
        remaining: totalRemaining || 0,
        sampleUrls: images.slice(0, 3).map(i => i.url),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let migrated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const img of images) {
      try {
        const propertyId = img.property_id || "orphan";
        const uploadId = crypto.randomUUID();

        // Download from Cloudinary
        const downloaded = await downloadImage(img.url);
        if (!downloaded) {
          // Image is truly dead — mark it so we don't retry
          await supabaseAdmin
            .from("property_images")
            .update({ storage_provider: "cloudinary_dead" } as any)
            .eq("id", img.id);
          failed++;
          errors.push(`${img.id}: download failed (${img.url.substring(0, 80)})`);
          continue;
        }

        // Determine extension from content type
        const ext = downloaded.contentType.includes("png") ? "png" 
          : downloaded.contentType.includes("webp") ? "webp" : "jpg";
        
        const r2KeyFull = `imoveis/${propertyId}/${uploadId}_full.${ext}`;

        // Upload to R2
        await putObjectToR2(aws, downloaded.data, r2KeyFull, downloaded.contentType, endpoint, bucket);

        // Build public URL
        const newUrl = publicUrl && !publicUrl.includes("r2.cloudflarestorage.com")
          ? `${publicUrl}/${r2KeyFull}`
          : `${endpoint}/${bucket}/${r2KeyFull}`;

        // Update DB record
        await supabaseAdmin
          .from("property_images")
          .update({
            url: newUrl,
            r2_key_full: r2KeyFull,
            storage_provider: "r2",
          } as any)
          .eq("id", img.id);

        migrated++;
        console.log(`[migrate] OK: ${img.id} -> ${r2KeyFull} (${(downloaded.data.length / 1024).toFixed(0)}KB)`);
      } catch (e) {
        failed++;
        errors.push(`${img.id}: ${e.message}`);
        console.error(`[migrate] FAIL: ${img.id}`, e.message);
      }
    }

    const remaining = (totalRemaining || 0) - migrated;

    return new Response(JSON.stringify({
      migrated,
      failed,
      remaining: Math.max(0, remaining),
      errors: errors.slice(0, 20),
      message: `Migradas ${migrated}/${images.length} imagens. ${remaining > 0 ? `Restam ${remaining}.` : "Concluído!"}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[migrate] Fatal:", error);
    return new Response(JSON.stringify({ error: "Erro interno", message: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

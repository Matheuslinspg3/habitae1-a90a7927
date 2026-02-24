import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

// ── AWS SigV4 with Web Crypto ──
function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(data: BufferSource): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", data));
}
async function hmac(key: ArrayBuffer, msg: string): Promise<ArrayBuffer> {
  const ck = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", ck, new TextEncoder().encode(msg));
}
async function signingKey(secret: string, date: string, region: string, service: string) {
  let k: ArrayBuffer = await hmac(new TextEncoder().encode("AWS4" + secret).buffer, date);
  k = await hmac(k, region);
  k = await hmac(k, service);
  k = await hmac(k, "aws4_request");
  return k;
}

async function uploadToR2(body: Uint8Array, objectKey: string, contentType: string): Promise<string | null> {
  const accessKey = (Deno.env.get("R2_ACCESS_KEY_ID") ?? "").trim();
  const secretKey = (Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "").trim();
  const endpoint = (Deno.env.get("R2_ENDPOINT") ?? "").trim().replace(/\/$/, "");
  const bucket = (Deno.env.get("R2_BUCKET_NAME") ?? "").trim();
  const publicUrl = (Deno.env.get("R2_PUBLIC_URL") ?? "").trim();

  if (!accessKey || !secretKey || !endpoint || !bucket) {
    console.error("R2 config incomplete");
    return null;
  }

  const host = new URL(endpoint).host;
  const canonicalUri = `/${bucket}/${objectKey}`;
  const url = `${endpoint}${canonicalUri}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(body);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest =
    "PUT\n" + canonicalUri + "\n\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + payloadHash;

  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const canonicalRequestHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));
  const stringToSign = "AWS4-HMAC-SHA256\n" + amzDate + "\n" + credentialScope + "\n" + canonicalRequestHash;

  const sk = await signingKey(secretKey, dateStamp, "auto", "s3");
  const signature = toHex(await hmac(sk, stringToSign));
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const r2 = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorization,
    },
    body,
  });

  if (!r2.ok) {
    const err = await r2.text();
    console.error(`R2 ${r2.status}: ${err}`);
    return null;
  }

  if (publicUrl && !publicUrl.includes("r2.cloudflarestorage.com")) {
    return `${publicUrl.replace(/\/$/, "")}/${objectKey}`;
  }
  return url;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { file_id, property_id, size = "thumbnail" } = body;
    // size: "thumbnail" (w400, ~15KB) or "full" (w1600, ~200KB)

    if (!file_id || !property_id) {
      return new Response(JSON.stringify({ error: "file_id e property_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Cache request: file_id=${file_id}, property_id=${property_id}, size=${size}`);

    // Check if already cached
    const { data: existing } = await supabase
      .from("property_images")
      .select("id, cached_thumbnail_url, cache_status")
      .eq("property_id", property_id)
      .eq("drive_file_id", file_id)
      .maybeSingle();

    if (existing?.cache_status === "thumbnail" && size === "thumbnail" && existing.cached_thumbnail_url) {
      return new Response(JSON.stringify({ url: existing.cached_thumbnail_url, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (existing?.cache_status === "full" && existing.cached_thumbnail_url) {
      return new Response(JSON.stringify({ url: existing.cached_thumbnail_url, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download from Google Drive
    const width = size === "full" ? "1600" : "400";
    const driveUrls = [
      `https://lh3.googleusercontent.com/d/${file_id}=w${width}`,
      `https://drive.google.com/thumbnail?id=${file_id}&sz=w${width}`,
    ];

    let imageBytes: Uint8Array | null = null;
    let contentType = "image/jpeg";

    for (const imgUrl of driveUrls) {
      try {
        const resp = await fetch(imgUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "image/*,*/*;q=0.8",
            Referer: "https://drive.google.com/",
          },
          redirect: "follow",
        });
        const ct = resp.headers.get("content-type") || "";
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          if ((ct.startsWith("image/") || ct === "application/octet-stream") && buf.byteLength > 2000) {
            contentType = ct.startsWith("image/") ? ct : "image/jpeg";
            imageBytes = new Uint8Array(buf);
            console.log(`Downloaded ${imageBytes.length} bytes from ${imgUrl.substring(0, 60)}`);
            break;
          }
        }
      } catch (e) {
        console.log(`Fetch error for ${imgUrl.substring(0, 50)}: ${e}`);
      }
    }

    if (!imageBytes) {
      // Mark as failed
      if (existing) {
        await supabase.from("property_images").update({ cache_status: "failed" }).eq("id", existing.id);
      }
      return new Response(JSON.stringify({ error: "Não foi possível baixar a imagem", cached: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload to R2
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const objectKey = `properties/${property_id}/drive/${file_id}_${size}.${ext}`;
    const r2Url = await uploadToR2(imageBytes, objectKey, contentType);

    if (!r2Url) {
      return new Response(JSON.stringify({ error: "Falha no upload para storage", cached: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update DB record
    const newStatus = size === "full" ? "full" : "thumbnail";
    if (existing) {
      await supabase.from("property_images").update({
        cached_thumbnail_url: r2Url,
        cache_status: newStatus,
        url: r2Url,
        source: "drive-cached",
      }).eq("id", existing.id);
    }

    console.log(`Cached ${size} for file ${file_id}: ${r2Url}`);

    return new Response(JSON.stringify({ url: r2Url, cached: true, size: newStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Cache error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao cachear imagem" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

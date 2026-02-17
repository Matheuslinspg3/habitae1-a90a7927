import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const fileId = url.searchParams.get("id");
    const size = url.searchParams.get("sz") || "w800";

    if (!fileId || !/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
      console.error("Missing or invalid file ID:", fileId);
      return new Response("Missing or invalid file ID", {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log(`Proxying image for file ID: ${fileId}, size: ${size}`);

    // Try multiple Google Drive image URLs in order of reliability
    const sizeNum = size.replace("w", "");
    const urls = [
      `https://lh3.googleusercontent.com/d/${fileId}=w${sizeNum}`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=${size}`,
      `https://drive.google.com/uc?export=view&id=${fileId}`,
    ];

    for (const imgUrl of urls) {
      try {
        console.log(`Trying URL: ${imgUrl}`);
        const resp = await fetch(imgUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            Referer: "https://drive.google.com/",
          },
          redirect: "follow",
        });

        const ct = resp.headers.get("content-type") || "";
        console.log(`Response status: ${resp.status}, content-type: ${ct}, url: ${imgUrl}`);

        if (resp.ok && (ct.startsWith("image/") || ct === "application/octet-stream")) {
          const body = await resp.arrayBuffer();
          console.log(`Body size: ${body.byteLength} bytes`);
          if (body.byteLength > 1000) {
            return new Response(body, {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": ct.startsWith("image/") ? ct : "image/jpeg",
                "Cache-Control": "public, max-age=86400, s-maxage=604800",
                "X-Source": "drive-proxy",
              },
            });
          }
        }
      } catch (e) {
        console.error(`Failed URL ${imgUrl}:`, e);
      }
    }

    console.error(`All URLs failed for file ID: ${fileId}`);

    // Fallback: return a 1x1 transparent pixel
    const pixel = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
      0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
      0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
      0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
    ]);
    return new Response(pixel, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "image/gif",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response("Internal error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});

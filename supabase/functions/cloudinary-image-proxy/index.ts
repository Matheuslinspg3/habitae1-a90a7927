const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get("url");

    if (!imageUrl || !imageUrl.includes("res.cloudinary.com")) {
      return new Response("Invalid or missing Cloudinary URL", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Add Cloudinary transformations for optimization
    // Convert to auto format/quality for smaller sizes
    const optimizedUrl = imageUrl.replace(
      "/image/upload/",
      "/image/upload/f_auto,q_auto/"
    );

    const resp = await fetch(optimizedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });

    const ct = resp.headers.get("content-type") || "";

    if (resp.ok && (ct.startsWith("image/") || ct === "application/octet-stream")) {
      const body = await resp.arrayBuffer();
      return new Response(body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": ct.startsWith("image/") ? ct : "image/jpeg",
          "Cache-Control": "public, max-age=604800, s-maxage=2592000",
          "X-Source": "cloudinary-proxy",
        },
      });
    }

    // If optimized URL failed, try original
    if (!resp.ok) {
      const fallbackResp = await fetch(imageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "image/*,*/*;q=0.8",
        },
      });

      const fbCt = fallbackResp.headers.get("content-type") || "";
      if (fallbackResp.ok && (fbCt.startsWith("image/") || fbCt === "application/octet-stream")) {
        const body = await fallbackResp.arrayBuffer();
        return new Response(body, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": fbCt.startsWith("image/") ? fbCt : "image/jpeg",
            "Cache-Control": "public, max-age=604800, s-maxage=2592000",
            "X-Source": "cloudinary-proxy-fallback",
          },
        });
      }
    }

    console.error(`Cloudinary proxy failed for: ${imageUrl}, status: ${resp.status}`);

    // Return transparent pixel as fallback
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
    console.error("Cloudinary proxy error:", error);
    return new Response("Internal error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});

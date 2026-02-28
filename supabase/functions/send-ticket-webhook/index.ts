const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { webhook_url, payload } = body;

    if (!webhook_url || !payload) {
      return new Response(JSON.stringify({ error: "webhook_url and payload required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch(webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();

    return new Response(JSON.stringify({ status: resp.status, response: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

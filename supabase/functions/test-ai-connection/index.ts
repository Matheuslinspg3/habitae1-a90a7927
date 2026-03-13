import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { url, type } = await req.json();
    if (!url || !type) throw new Error("Missing url or type");

    // Sanitize URL
    const cleanUrl = url.replace(/\/+$/, "");
    const endpoint = type === "sd"
      ? `${cleanUrl}/sdapi/v1/sd-models`
      : `${cleanUrl}/api/tags`;

    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text();
      return new Response(
        JSON.stringify({ ok: false, error: `Status ${response.status}: ${text.slice(0, 200)}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const models = type === "sd"
      ? (data as any[]).map((m: any) => m.title || m.model_name).slice(0, 5)
      : (data.models as any[] || []).map((m: any) => m.name).slice(0, 5);

    return new Response(
      JSON.stringify({ ok: true, models }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message || "Connection failed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

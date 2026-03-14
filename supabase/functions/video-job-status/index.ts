import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support both GET (polling from frontend) and POST (callback from VPS)
    if (req.method === "POST") {
      // Callback from external service to update job status
      const body = await req.json();
      const { job_id, status, progress, phase, video_url, duration_seconds, file_size_bytes, error: jobError } = body;

      if (!job_id) {
        return new Response(JSON.stringify({ error: "job_id required" }), { status: 400, headers: corsHeaders });
      }

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (status) updateData.job_status = status;
      if (progress !== undefined) updateData.job_progress = progress;
      if (phase) updateData.job_phase = phase;
      if (video_url) updateData.video_url = video_url;
      if (duration_seconds) updateData.duration_seconds = duration_seconds;
      if (file_size_bytes) updateData.file_size_bytes = file_size_bytes;
      if (jobError) updateData.job_error = jobError;

      await adminClient.from("generated_videos").update(updateData).eq("job_id", job_id);

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET: polling from frontend
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const jobId = url.searchParams.get("job_id");

    if (!jobId) {
      return new Response(JSON.stringify({ error: "job_id required" }), { status: 400, headers: corsHeaders });
    }

    const { data: video, error } = await supabase
      .from("generated_videos")
      .select("job_status, job_progress, job_phase, video_url, duration_seconds, file_size_bytes, job_error")
      .eq("job_id", jobId)
      .single();

    if (error || !video) {
      return new Response(JSON.stringify({ error: "Job não encontrado" }), { status: 404, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      status: video.job_status,
      progress: video.job_progress || 0,
      phase: video.job_phase,
      video_url: video.video_url,
      duration_seconds: video.duration_seconds,
      file_size_bytes: video.file_size_bytes,
      error: video.job_error,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("video-job-status error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500, headers: corsHeaders });
  }
});

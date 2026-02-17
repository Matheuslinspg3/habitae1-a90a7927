import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceUsageLimit, trackUsageEvent } from "../_shared/usage-governor.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function getUsage(cloudName: string, apiKey: string, apiSecret: string): Promise<any> {
  const auth = btoa(`${apiKey}:${apiSecret}`);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/usage`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) return { error: `${res.status} ${await res.text()}` };
  return await res.json();
}

async function deleteAllResources(cloudName: string, apiKey: string, apiSecret: string): Promise<{ deleted: number; errors: number; usage?: any }> {
  const auth = btoa(`${apiKey}:${apiSecret}`);
  let deleted = 0;
  let errors = 0;

  // First, get usage to confirm credentials and see resource counts
  const usage = await getUsage(cloudName, apiKey, apiSecret);
  console.log(`Usage for ${cloudName}:`, JSON.stringify({
    resources: usage.resources,
    derived_resources: usage.derived_resources,
    error: usage.error,
  }));

  for (const resourceType of ['image', 'video', 'raw']) {
    let hasMore = true;
    let nextCursor: string | undefined;

    while (hasMore) {
      let url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}/upload?max_results=500`;
      if (nextCursor) url += `&next_cursor=${nextCursor}`;

      const listRes = await fetch(url, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (!listRes.ok) {
        const text = await listRes.text();
        console.error(`List ${resourceType} error: ${listRes.status} ${text}`);
        break;
      }

      const data = await listRes.json();
      const resources = data.resources || [];
      console.log(`Found ${resources.length} ${resourceType} resources`);

      if (resources.length === 0) {
        hasMore = false;
        break;
      }

      for (let i = 0; i < resources.length; i += 100) {
        const batch = resources.slice(i, i + 100);
        const publicIds = batch.map((r: any) => r.public_id);

        const delRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}/upload`, {
          method: 'DELETE',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ public_ids: publicIds }),
        });

        if (delRes.ok) {
          const delData = await delRes.json();
          const deletedIds = Object.entries(delData.deleted || {}).filter(([, v]) => v === 'deleted');
          deleted += deletedIds.length;
          errors += publicIds.length - deletedIds.length;
          console.log(`Deleted ${resourceType}: ${deletedIds.length}/${publicIds.length}`);
        } else {
          const errText = await delRes.text();
          console.error(`Delete ${resourceType} error: ${delRes.status} ${errText}`);
          errors += publicIds.length;
        }
      }

      nextCursor = data.next_cursor;
      hasMore = !!nextCursor;
    }
  }

  return { deleted, errors, usage };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestStartedAt = Date.now();
  const telemetry: { userId?: string; blockedReason?: string | null; responseStatus?: number } = {};

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      telemetry.responseStatus = 401;
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      telemetry.responseStatus = 401;
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    telemetry.userId = user.id;

    const limitResult = await enforceUsageLimit({
      supabase,
      functionName: 'cloudinary-purge',
      userId: user.id,
      metadata: { endpoint: 'cloudinary-purge' },
    });
    if (!limitResult.allowed) {
      telemetry.blockedReason = limitResult.reason;
      telemetry.responseStatus = 429;
      return new Response(JSON.stringify({ error: 'Limite de uso excedido', reason: limitResult.reason, retry_after: limitResult.retryAfterSeconds }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(limitResult.retryAfterSeconds) },
      });
    }

    const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
    const isDev = roles?.some((r: any) => r.role === 'developer');
    if (!isDev) {
      telemetry.responseStatus = 403;
      return new Response(JSON.stringify({ error: 'Acesso negado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* no body = purge all */ }
    const accounts = body.accounts || ['cloudinary1', 'cloudinary2'];
    const results: Record<string, any> = {};

    if (accounts.includes('cloudinary1')) {
      const cn = (Deno.env.get('CLOUDINARY_CLOUD_NAME') ?? '').trim();
      const ak = (Deno.env.get('CLOUDINARY_API_KEY') ?? '').trim();
      const as_ = (Deno.env.get('CLOUDINARY_API_SECRET') ?? '').trim();
      results.cloudinary1 = (cn && ak && as_) ? await deleteAllResources(cn, ak, as_) : { error: 'Não configurado' };
    }

    if (accounts.includes('cloudinary2')) {
      const cn = (Deno.env.get('CLOUDINARY2_CLOUD_NAME') ?? '').trim();
      const ak = (Deno.env.get('CLOUDINARY2_API_KEY') ?? '').trim();
      const as_ = (Deno.env.get('CLOUDINARY2_API_SECRET') ?? '').trim();
      results.cloudinary2 = (cn && ak && as_) ? await deleteAllResources(cn, ak, as_) : { error: 'Não configurado' };
    }

    await supabase.from('deleted_property_media').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    telemetry.responseStatus = 200;
    return new Response(JSON.stringify({ success: true, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    telemetry.responseStatus = telemetry.responseStatus ?? 500;
    console.error('cloudinary-purge error:', e);
    return new Response(JSON.stringify({ error: 'Erro interno', message: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } finally {
    if (telemetry.userId) {
      const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
      await trackUsageEvent({
        supabase,
        functionName: 'cloudinary-purge',
        userId: telemetry.userId,
        allowed: !telemetry.blockedReason,
        reason: telemetry.blockedReason ?? null,
        responseStatus: telemetry.responseStatus,
        durationMs: Date.now() - requestStartedAt,
      });
    }
  }
});

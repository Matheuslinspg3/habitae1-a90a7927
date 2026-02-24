import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function cloudAuth(apiKey: string, apiSecret: string): string {
  return 'Basic ' + btoa(`${apiKey}:${apiSecret}`);
}

function adminUrl(cloudName: string, path: string): string {
  return `https://api.cloudinary.com/v1_1/${cloudName}${path}`;
}

interface CloudinaryResource {
  public_id: string;
  bytes: number;
  created_at: string;
  folder: string;
}

async function verifyDeveloper(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Não autorizado');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error } = await supabase.auth.getClaims(token);
  if (error || !claimsData?.claims) throw new Error('Não autenticado');
  const user = { id: claimsData.claims.sub as string };

  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  if (!roles?.some(r => r.role === 'developer')) throw new Error('Acesso negado');

  return user;
}

function getCloudinaryCreds(account?: string) {
  // account = "2" uses CLOUDINARY2_* secrets, default uses CLOUDINARY_*
  const suffix = account === '2' ? '2' : '';
  const cloudName = (Deno.env.get(`CLOUDINARY${suffix}_CLOUD_NAME`) ?? '').trim();
  const apiKey = (Deno.env.get(`CLOUDINARY${suffix}_API_KEY`) ?? '').trim();
  const apiSecret = (Deno.env.get(`CLOUDINARY${suffix}_API_SECRET`) ?? '').trim();
  if (!cloudName || !apiKey || !apiSecret) throw new Error(`Cloudinary${suffix ? ' 2' : ''} não configurado`);
  return { cloudName, auth: cloudAuth(apiKey, apiSecret) };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await verifyDeveloper(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    const account = body.account as string | undefined; // "2" for Cloudinary 2
    const { cloudName, auth } = getCloudinaryCreds(account);

    // ── ACTION: preview (with resumable cursor) ──
    if (action === 'preview') {
      const prefix = body.prefix as string | undefined;
      const resumeCursor = body.cursor as string | undefined;
      console.log(`Cloudinary${account === '2' ? ' 2' : ''} preview - prefix: ${prefix || '(all)'}, cursor: ${resumeCursor ? 'yes' : 'initial'}`);

      const allResources: CloudinaryResource[] = [];
      let cursor: string | undefined = resumeCursor;
      let totalBytes = 0;
      let truncated = false;
      const startMs = Date.now();
      const MAX_DURATION_MS = 20_000;

      for (let page = 0; page < 300; page++) {
        if (Date.now() - startMs > MAX_DURATION_MS) {
          truncated = true;
          console.log(`[preview] Time limit reached after ${page} pages, ${allResources.length} resources`);
          break;
        }
        const params = new URLSearchParams({ max_results: '500' });
        if (prefix) params.set('prefix', prefix);
        if (cursor) params.set('next_cursor', cursor);

        const res = await fetch(
          adminUrl(cloudName, `/resources/image/upload?${params}`),
          { headers: { Authorization: auth } }
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`List failed (${res.status}): ${text}`);
        }

        const data = await res.json();
        for (const r of data.resources || []) {
          allResources.push({ public_id: r.public_id, bytes: r.bytes || 0, created_at: r.created_at, folder: r.folder || '' });
          totalBytes += r.bytes || 0;
        }

        cursor = data.next_cursor;
        if (!cursor) break;
      }

      const folders: Record<string, { count: number; bytes: number }> = {};
      for (const r of allResources) {
        const f = r.folder || '(root)';
        if (!folders[f]) folders[f] = { count: 0, bytes: 0 };
        folders[f].count++;
        folders[f].bytes += r.bytes;
      }

      return new Response(JSON.stringify({
        total_resources: allResources.length,
        total_bytes: totalBytes,
        folders,
        public_ids: allResources.map(r => r.public_id),
        truncated,
        next_cursor: truncated ? cursor : null,
        oldest: allResources.length > 0
          ? allResources.reduce((a, b) => a.created_at < b.created_at ? a : b).created_at
          : null,
        newest: allResources.length > 0
          ? allResources.reduce((a, b) => a.created_at > b.created_at ? a : b).created_at
          : null,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ACTION: delete-batch ──
    if (action === 'delete-batch') {
      const publicIds = body.public_ids as string[];
      if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
        return new Response(JSON.stringify({ error: 'public_ids obrigatório' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const batch = publicIds.slice(0, 100);
      const params = new URLSearchParams();
      batch.forEach(id => params.append('public_ids[]', id));

      const res = await fetch(
        adminUrl(cloudName, `/resources/image/upload`),
        {
          method: 'DELETE',
          headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        return new Response(JSON.stringify({ deleted: 0, error: `${res.status}: ${text}` }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await res.json();
      const deleted = result.deleted
        ? Object.values(result.deleted).filter((v: unknown) => v === 'deleted').length
        : 0;

      console.log(`Batch delete (${account === '2' ? 'Cloud2' : 'Cloud1'}): ${deleted}/${batch.length} deleted by ${user.id}`);

      return new Response(JSON.stringify({ deleted, attempted: batch.length }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ACTION: delete-by-prefix ──
    if (action === 'delete-by-prefix') {
      const targetPrefix = body.prefix as string;
      if (!targetPrefix) {
        return new Response(JSON.stringify({ error: 'prefix obrigatório para esta ação' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Delete by prefix (${account === '2' ? 'Cloud2' : 'Cloud1'}): "${targetPrefix}" by ${user.id}`);

      const params = new URLSearchParams({ prefix: targetPrefix });
      const res = await fetch(
        adminUrl(cloudName, `/resources/image/upload?${params}`),
        {
          method: 'DELETE',
          headers: { Authorization: auth },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        return new Response(JSON.stringify({ deleted: 0, error: `${res.status}: ${text}` }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await res.json();
      const deleted = result.deleted
        ? Object.values(result.deleted).filter((v: unknown) => v === 'deleted').length
        : 0;
      const partial = !!result.next_cursor;

      console.log(`Prefix delete: ${deleted} deleted, partial: ${partial}`);

      return new Response(JSON.stringify({
        deleted,
        partial,
        next_cursor: result.next_cursor || null,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ACTION: delete-all-by-prefix ──
    if (action === 'delete-all-by-prefix') {
      const targetPrefix = body.prefix as string;
      if (!targetPrefix) {
        return new Response(JSON.stringify({ error: 'prefix obrigatório para esta ação' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Delete ALL by prefix (${account === '2' ? 'Cloud2' : 'Cloud1'}): "${targetPrefix}" by ${user.id}`);

      let totalDeleted = 0;
      let rounds = 0;
      const startMs = Date.now();
      const MAX_MS = 22_000;

      while (Date.now() - startMs < MAX_MS) {
        rounds++;
        const params = new URLSearchParams({ prefix: targetPrefix });
        const res = await fetch(
          adminUrl(cloudName, `/resources/image/upload?${params}`),
          { method: 'DELETE', headers: { Authorization: auth } }
        );

        if (!res.ok) {
          const text = await res.text();
          return new Response(JSON.stringify({ deleted: totalDeleted, rounds, error: `${res.status}: ${text}` }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const result = await res.json();
        const deleted = result.deleted
          ? Object.values(result.deleted).filter((v: unknown) => v === 'deleted').length
          : 0;

        totalDeleted += deleted;

        if (deleted === 0 || !result.next_cursor) break;
      }

      console.log(`Delete ALL by prefix done: ${totalDeleted} in ${rounds} rounds`);

      return new Response(JSON.stringify({
        deleted: totalDeleted,
        rounds,
        time_ms: Date.now() - startMs,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      error: 'Ação inválida',
      valid_actions: ['preview', 'delete-batch', 'delete-by-prefix', 'delete-all-by-prefix'],
    }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('cloudinary-cleanup error:', e);
    const msg = e instanceof Error ? e.message : 'Erro interno';
    const status = msg.includes('Não autor') || msg.includes('Não autentic') ? 401
      : msg.includes('Acesso negado') ? 403 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

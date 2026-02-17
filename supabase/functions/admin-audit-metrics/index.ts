import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Admin audit metrics request received');

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.log('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client with user's auth for verification
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated via JWT claims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.log('User not authenticated:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const user = { id: claimsData.claims.sub as string, email: claimsData.claims.email as string };

    console.log('User authenticated:', user.email);

    // Verify user is system admin using the security function
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_system_admin');
    
    if (adminError) {
      console.error('Error checking admin status:', adminError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isAdmin) {
      console.log('User is not admin:', user.email);
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores do sistema.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin access granted for:', user.email);

    // Parse request body
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'all';

    // Admin client to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const result: Record<string, any> = {};

    // Get table counts
    if (action === 'all' || action === 'counts') {
      console.log('Fetching table counts...');
      const { data: counts, error: countsError } = await supabase.rpc('admin_get_table_counts');
      if (countsError) {
        console.error('Error getting counts:', countsError);
      } else {
        result.counts = counts;
      }
    }

    // Get properties by status
    if (action === 'all' || action === 'status') {
      console.log('Fetching properties by status...');
      const { data: byStatus, error: statusError } = await supabase.rpc('admin_get_properties_by_status');
      if (statusError) {
        console.error('Error getting status:', statusError);
      } else {
        result.propertiesByStatus = byStatus;
      }
    }

    // Get org metrics
    if (action === 'all' || action === 'orgs') {
      console.log('Fetching org metrics...');
      const { data: orgMetrics, error: orgError } = await supabase.rpc('admin_get_org_metrics');
      if (orgError) {
        console.error('Error getting org metrics:', orgError);
      } else {
        result.organizations = orgMetrics;
      }
    }

    // Get growth metrics
    if (action === 'all' || action === 'growth') {
      console.log('Fetching growth metrics...');
      const { data: growth, error: growthError } = await supabase.rpc('admin_get_growth_metrics');
      if (growthError) {
        console.error('Error getting growth:', growthError);
      } else {
        result.growth = growth;
      }
    }

    // Get system health
    if (action === 'all' || action === 'health') {
      console.log('Fetching system health...');
      const { data: health, error: healthError } = await supabase.rpc('admin_get_system_health');
      if (healthError) {
        console.error('Error getting health:', healthError);
      } else {
        result.health = health;
      }
    }

    // Get table sizes
    if (action === 'all' || action === 'sizes') {
      console.log('Fetching table sizes...');
      const { data: sizes, error: sizesError } = await supabase.rpc('admin_get_table_sizes');
      if (sizesError) {
        console.error('Error getting sizes:', sizesError);
      } else {
        result.tableSizes = sizes;
      }
    }

    // Get Cloudinary usage
    if (action === 'all' || action === 'cloudinary') {
      console.log('Fetching Cloudinary usage...');
      try {
        const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
        const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
        const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

        if (cloudName && apiKey && apiSecret) {
          const authString = btoa(`${apiKey}:${apiSecret}`);
          const cloudinaryResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/usage`,
            {
              headers: {
                'Authorization': `Basic ${authString}`,
              },
            }
          );

          if (cloudinaryResponse.ok) {
            const cloudinaryData = await cloudinaryResponse.json();
            result.cloudinary = {
              storage: {
                used: cloudinaryData.storage?.usage || 0,
                limit: cloudinaryData.storage?.limit || 0,
                usedFormatted: formatBytes(cloudinaryData.storage?.usage || 0),
                limitFormatted: formatBytes(cloudinaryData.storage?.limit || 0),
                percentage: cloudinaryData.storage?.limit 
                  ? Math.round((cloudinaryData.storage.usage / cloudinaryData.storage.limit) * 100)
                  : 0,
              },
              bandwidth: {
                used: cloudinaryData.bandwidth?.usage || 0,
                limit: cloudinaryData.bandwidth?.limit || 0,
                usedFormatted: formatBytes(cloudinaryData.bandwidth?.usage || 0),
                limitFormatted: formatBytes(cloudinaryData.bandwidth?.limit || 0),
                percentage: cloudinaryData.bandwidth?.limit 
                  ? Math.round((cloudinaryData.bandwidth.usage / cloudinaryData.bandwidth.limit) * 100)
                  : 0,
              },
              transformations: {
                used: cloudinaryData.transformations?.usage || 0,
                limit: cloudinaryData.transformations?.limit || 0,
                percentage: cloudinaryData.transformations?.limit 
                  ? Math.round((cloudinaryData.transformations.usage / cloudinaryData.transformations.limit) * 100)
                  : 0,
              },
              credits: cloudinaryData.credits || null,
              plan: cloudinaryData.plan || 'unknown',
            };
          } else {
            console.error('Cloudinary API error:', cloudinaryResponse.status);
            result.cloudinary = { 
              error: 'Não foi possível obter métricas do Cloudinary',
              status: cloudinaryResponse.status
            };
          }
        } else {
          result.cloudinary = { 
            error: 'Credenciais do Cloudinary não configuradas' 
          };
        }
      } catch (cloudinaryError) {
        console.error('Cloudinary error:', cloudinaryError);
        result.cloudinary = { 
          error: 'Erro ao consultar Cloudinary' 
        };
      }
    }


    if (action === 'all' || action === 'telemetry') {
      console.log('Fetching expensive function telemetry...');
      const expensiveFunctions = ['imobzi-process', 'extract-property-pdf', 'cloudinary-purge', 'scrape-drive-photos'];
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: usageEvents, error: usageErr } = await supabaseAdmin
        .from('function_usage_events')
        .select('function_name, organization_id, user_id, allowed, reason, response_status, duration_ms, created_at')
        .in('function_name', expensiveFunctions)
        .gte('created_at', since24h)
        .order('created_at', { ascending: false })
        .limit(5000);

      const { data: activeBlocks } = await supabaseAdmin
        .from('function_usage_blocks')
        .select('function_name, organization_id, user_id, reason, blocked_until')
        .in('function_name', expensiveFunctions)
        .gt('blocked_until', new Date().toISOString())
        .order('blocked_until', { ascending: false });

      if (!usageErr) {
        const summaryByFunction = expensiveFunctions.map((fn) => {
          const rows = (usageEvents || []).filter((row) => row.function_name === fn);
          const blocked = rows.filter((row) => !row.allowed).length;
          const avgDuration = rows.length > 0
            ? Math.round(rows.reduce((acc, row) => acc + (row.duration_ms || 0), 0) / rows.length)
            : 0;
          return {
            functionName: fn,
            totalCalls24h: rows.length,
            blockedCalls24h: blocked,
            blockRate: rows.length > 0 ? Number(((blocked / rows.length) * 100).toFixed(2)) : 0,
            avgDurationMs: avgDuration,
          };
        });

        result.functionTelemetry = {
          summaryByFunction,
          recentBlockedEvents: (usageEvents || []).filter((row) => !row.allowed).slice(0, 50),
          activeBlocks: activeBlocks || [],
        };
      } else {
        result.functionTelemetry = { error: 'Não foi possível carregar telemetria operacional' };
      }
    }

    // Add timestamp
    result.timestamp = new Date().toISOString();
    result.generatedBy = user.email;

    console.log('Metrics collected successfully');

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

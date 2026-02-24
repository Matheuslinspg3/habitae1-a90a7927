import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';
import { getCorsHeaders } from "../_shared/cors.ts";

const IMOBZI_API_BASE = 'https://api.imobzi.app/v1';
const BATCH_SIZE = 10;

// Timeout utility for network requests
async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// Generate SHA-256 hash for image deduplication
async function generateChecksum(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, apiKey: providedApiKey, runId, batch, batchIndex } = body;

    // For batch processing, we use service role directly (already authenticated)
    if (action === 'process-batch' && runId && batch) {
      return await processBatch(supabaseAdmin, runId, batch, batchIndex || 0);
    }

    // Get user from auth header for user-initiated actions
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const user = { id: claimsData.claims.sub as string };

    // Get user's organization
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'No organization found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = profile.organization_id;

    // Get API key from settings or use provided one
    let apiKey = providedApiKey;
    if (!apiKey) {
      const { data: settings } = await supabaseAdmin
        .from('imobzi_settings')
        .select('api_key_encrypted')
        .eq('organization_id', organizationId)
        .single();
      
      apiKey = settings?.api_key_encrypted;
    }

    switch (action) {
      case 'test-connection':
        return await testConnection(apiKey);

      case 'start-sync':
        return await startSync(supabaseAdmin, organizationId, user.id, apiKey);

      case 'check-status':
        return await checkSyncStatus(supabaseAdmin, organizationId);

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ERROR] Edge function error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function testConnection(apiKey: string) {
  if (!apiKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'API Key não fornecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('[TEST] Testing connection to Imobzi API...');
    const response = await fetchWithTimeout(
      `${IMOBZI_API_BASE}/properties?smart_list=all&limit=1`,
      {
        headers: {
          'X-Imobzi-Secret': apiKey,
          'Accept': 'application/json',
        },
      },
      12000
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TEST] Imobzi API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro na API do Imobzi: ${response.status}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await safeJson(response);
    const totalProperties = data?.paging?.total || data?.properties?.length || 0;
    console.log(`[TEST] Connection successful, ${totalProperties} properties found`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalProperties,
        message: 'Conexão estabelecida com sucesso' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Falha ao conectar com o Imobzi';
    console.error('[TEST] Connection test error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function startSync(
  supabaseAdmin: any,
  organizationId: string,
  userId: string,
  apiKey: string
) {
  if (!apiKey) {
    console.error('[SYNC] API Key not configured');
    return new Response(
      JSON.stringify({ success: false, error: 'API Key não configurada' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`[SYNC] Starting sync for organization ${organizationId}`);

  try {
    // Check for existing running sync
    const { data: existingRun, error: checkError } = await supabaseAdmin
      .from('import_runs')
      .select('id, status')
      .eq('organization_id', organizationId)
      .in('status', ['running', 'starting'])
      .maybeSingle();

    if (checkError) {
      console.error('[SYNC] Error checking existing runs:', checkError);
      throw checkError;
    }

    if (existingRun) {
      console.log('[SYNC] Sync already running:', existingRun.id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Uma sincronização já está em andamento' 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create import run with 'starting' status
    const { data: importRun, error: runError } = await supabaseAdmin
      .from('import_runs')
      .insert({
        organization_id: organizationId,
        source_provider: 'imobzi',
        status: 'starting',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) {
      console.error('[SYNC] Error creating import run:', runError);
      throw runError;
    }

    console.log('[SYNC] Import run created:', importRun.id);

    // Fetch all properties from Imobzi (Phase A - Listing)
    console.log('[SYNC] Fetching properties from Imobzi API...');
    const properties = await fetchAllProperties(apiKey);
    console.log(`[SYNC] Fetched ${properties.length} properties from Imobzi`);

    if (properties.length === 0) {
      await supabaseAdmin
        .from('import_runs')
        .update({
          status: 'completed',
          finished_at: new Date().toISOString(),
          total_properties: 0,
          imported: 0,
          updated: 0,
          errors: 0,
        })
        .eq('id', importRun.id);

      return new Response(
        JSON.stringify({ 
          success: true,
          imported: 0,
          updated: 0,
          errors: 0,
          message: 'Nenhum imóvel encontrado na API do Imobzi',
          runId: importRun.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store property data and update run status to running
    const propertyIds = properties.map(p => p.db_id || p.property_id || p.id);
    await supabaseAdmin
      .from('import_runs')
      .update({ 
        status: 'running',
        total_properties: properties.length,
        pending_property_ids: propertyIds,
      })
      .eq('id', importRun.id);

    // Process first batch immediately
    const firstBatch = properties.slice(0, BATCH_SIZE);
    const remainingProperties = properties.slice(BATCH_SIZE);

    // Start processing first batch
    const result = await processPropertiesBatch(
      supabaseAdmin,
      organizationId,
      userId,
      importRun.id,
      firstBatch,
      apiKey
    );

    // If there are more properties, trigger next batch asynchronously
    if (remainingProperties.length > 0) {
      console.log(`[SYNC] Triggering async processing for ${remainingProperties.length} remaining properties`);
      
      // Use EdgeRuntime.waitUntil for background processing
      const triggerNextBatch = async () => {
        try {
          await triggerNextBatchWithData(
            supabaseAdmin,
            organizationId,
            userId,
            importRun.id,
            remainingProperties,
            apiKey,
            1
          );
        } catch (e) {
          console.error('[SYNC] Error triggering next batch:', e);
        }
      };

      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(triggerNextBatch());
      } else {
        // Fallback: just don't wait for it
        triggerNextBatch();
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          status: 'processing',
          message: `Sincronização iniciada. Processando ${properties.length} imóveis em lotes.`,
          runId: importRun.id,
          batchesTotal: Math.ceil(properties.length / BATCH_SIZE),
          firstBatchResult: result,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If only one batch, mark as completed
    await finalizeSync(supabaseAdmin, importRun.id, organizationId);

    return new Response(
      JSON.stringify({ 
        success: true,
        imported: result.imported,
        updated: result.updated,
        errors: result.errors,
        runId: importRun.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SYNC] Fatal error:', error);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function triggerNextBatchWithData(
  supabaseAdmin: any,
  organizationId: string,
  userId: string,
  runId: string,
  properties: any[],
  apiKey: string,
  batchIndex: number
) {
  const batch = properties.slice(0, BATCH_SIZE);
  const remaining = properties.slice(BATCH_SIZE);

  console.log(`[BATCH-${batchIndex}] Processing batch of ${batch.length} properties`);

  const result = await processPropertiesBatch(
    supabaseAdmin,
    organizationId,
    userId,
    runId,
    batch,
    apiKey
  );

  console.log(`[BATCH-${batchIndex}] Completed:`, result);

  if (remaining.length > 0) {
    console.log(`[BATCH-${batchIndex}] ${remaining.length} properties remaining, triggering next batch`);
    await triggerNextBatchWithData(
      supabaseAdmin,
      organizationId,
      userId,
      runId,
      remaining,
      apiKey,
      batchIndex + 1
    );
  } else {
    console.log(`[BATCH-${batchIndex}] All batches complete, finalizing sync`);
    await finalizeSync(supabaseAdmin, runId, organizationId);
  }
}

async function processBatch(
  supabaseAdmin: any,
  runId: string,
  batch: any[],
  batchIndex: number
) {
  console.log(`[BATCH-${batchIndex}] Processing external batch request`);

  const { data: run } = await supabaseAdmin
    .from('import_runs')
    .select('organization_id')
    .eq('id', runId)
    .single();

  if (!run) {
    return new Response(
      JSON.stringify({ success: false, error: 'Import run not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: settings } = await supabaseAdmin
    .from('imobzi_settings')
    .select('api_key_encrypted')
    .eq('organization_id', run.organization_id)
    .single();

  if (!settings?.api_key_encrypted) {
    return new Response(
      JSON.stringify({ success: false, error: 'API key not found' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const result = await processPropertiesBatch(
    supabaseAdmin,
    run.organization_id,
    'system',
    runId,
    batch,
    settings.api_key_encrypted
  );

  return new Response(
    JSON.stringify({ success: true, ...result }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function finalizeSync(supabaseAdmin: any, runId: string, organizationId: string) {
  // Get aggregated results from run items
  const { data: items } = await supabaseAdmin
    .from('import_run_items')
    .select('status, photos_imported')
    .eq('run_id', runId);

  const imported = items?.filter((i: any) => i.status === 'success').length || 0;
  const errors = items?.filter((i: any) => i.status === 'error').length || 0;
  const imagesProcessed = items?.reduce((sum: number, i: any) => sum + (i.photos_imported || 0), 0) || 0;

  await supabaseAdmin
    .from('import_runs')
    .update({
      status: 'completed',
      finished_at: new Date().toISOString(),
      imported,
      errors,
      images_processed: imagesProcessed,
      pending_property_ids: null,
    })
    .eq('id', runId);

  await supabaseAdmin
    .from('imobzi_settings')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('organization_id', organizationId);

  console.log('[SYNC] Finalized sync:', { runId, imported, errors, imagesProcessed });
}

async function checkSyncStatus(supabaseAdmin: any, organizationId: string) {
  const { data: run } = await supabaseAdmin
    .from('import_runs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!run) {
    return new Response(
      JSON.stringify({ success: true, status: 'idle', message: 'Nenhuma sincronização encontrada' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { count: processedCount } = await supabaseAdmin
    .from('import_run_items')
    .select('id', { count: 'exact' })
    .eq('run_id', run.id);

  return new Response(
    JSON.stringify({
      success: true,
      runId: run.id,
      status: run.status,
      total: run.total_properties || 0,
      processed: processedCount || 0,
      imported: run.imported || 0,
      updated: run.updated || 0,
      errors: run.errors || 0,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function fetchAllProperties(apiKey: string): Promise<any[]> {
  const allProperties: any[] = [];
  let cursor: string | null = null;
  let hasMore = true;
  let pageCount = 0;

  while (hasMore) {
    const url = new URL(`${IMOBZI_API_BASE}/properties`);
    url.searchParams.set('smart_list', 'available');
    url.searchParams.set('limit', '50');
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    console.log(`[FETCH] Fetching page ${pageCount + 1}...`);

    const response = await fetchWithTimeout(
      url.toString(),
      {
        headers: {
          'X-Imobzi-Secret': apiKey,
          'Accept': 'application/json',
        },
      },
      12000
    );

    if (!response.ok) {
      console.error('[FETCH] Failed to fetch properties:', response.status);
      break;
    }

    const data = await safeJson(response);
    if (!data?.properties) break;

    allProperties.push(...data.properties);
    pageCount++;
    console.log(`[FETCH] Page ${pageCount}: ${data.properties.length} properties (total: ${allProperties.length})`);
    
    cursor = data.paging?.cursor || null;
    hasMore = !!cursor && data.properties.length > 0;
  }

  return allProperties;
}

async function processPropertiesBatch(
  supabaseAdmin: any,
  organizationId: string,
  userId: string,
  runId: string,
  properties: any[],
  apiKey: string
) {
  const result = {
    imported: 0,
    updated: 0,
    errors: 0,
    skipped: 0,
    imagesProcessed: 0,
    imagesFailed: 0,
  };

  // Get Cloudinary credentials
  const cloudinaryCloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const cloudinaryApiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const cloudinaryApiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
  const hasCloudinary = cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret;

  for (const prop of properties) {
    const propertyId = prop.db_id || prop.property_id || prop.id;
    
    try {
      // Fetch complete property details from singular endpoint
      let details = prop;
      try {
        const detailResponse = await fetchWithTimeout(
          `${IMOBZI_API_BASE}/property/${propertyId}`,
          {
            headers: {
              'X-Imobzi-Secret': apiKey,
              'Accept': 'application/json',
            },
          },
          15000
        );
        
        if (detailResponse.ok) {
          const detailData = await safeJson(detailResponse);
          if (detailData) {
            details = { ...prop, ...detailData };
          }
        }
      } catch (e) {
        console.warn(`[PROP-${propertyId}] Failed to fetch details:`, e instanceof Error ? e.message : e);
      }

      // Map all property data
      const propertyData = mapPropertyData(details, organizationId, userId);

      // Check if property already exists
      const { data: existing } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('source_provider', 'imobzi')
        .eq('source_property_id', String(propertyId))
        .maybeSingle();

      let savedPropertyId: string;

      if (existing) {
        const { error } = await supabaseAdmin
          .from('properties')
          .update({
            ...propertyData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
        savedPropertyId = existing.id;
        result.updated++;
      } else {
        const { data: newProp, error } = await supabaseAdmin
          .from('properties')
          .insert(propertyData)
          .select('id')
          .single();

        if (error) throw error;
        savedPropertyId = newProp.id;
        result.imported++;
      }

      // Process photos
      const photoResult = await processPhotos(
        supabaseAdmin,
        organizationId,
        savedPropertyId,
        details,
        hasCloudinary ? { cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret } : null
      );
      result.imagesProcessed += photoResult.processed;
      result.imagesFailed += photoResult.failed;

      // Process owner data if available
      await processOwnerData(supabaseAdmin, organizationId, savedPropertyId, details);

      // Create import run item
      await supabaseAdmin
        .from('import_run_items')
        .insert({
          run_id: runId,
          source_property_id: String(propertyId),
          source_title: details.title || `Imóvel ${propertyId}`,
          status: 'success',
          property_id: savedPropertyId,
          photos_imported: photoResult.processed,
          detail_fetched: true,
        });

      console.log(`[PROP-${propertyId}] Processed successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[PROP-${propertyId}] Error:`, errorMessage);
      result.errors++;
      
      await supabaseAdmin
        .from('import_run_items')
        .insert({
          run_id: runId,
          source_property_id: String(propertyId),
          source_title: prop.title || 'Unknown',
          status: 'error',
          error_message: errorMessage,
        });
    }
  }

  return result;
}

async function processPhotos(
  supabaseAdmin: any,
  organizationId: string,
  propertyId: string,
  details: any,
  cloudinaryConfig: { cloudinaryCloudName: string; cloudinaryApiKey: string; cloudinaryApiSecret: string } | null
): Promise<{ processed: number; failed: number }> {
  const result = { processed: 0, failed: 0 };

  const photos: any[] = [];
  
  // Cover photo
  if (details.cover_photo?.url) {
    photos.push({ url: details.cover_photo.url, is_cover: true, kind: 'cover' });
  }
  
  // Photos array
  if (Array.isArray(details.photos)) {
    details.photos.forEach((p: any, i: number) => {
      const url = typeof p === 'string' ? p : p.url || p.photo_url;
      if (url) {
        photos.push({ url, is_cover: false, kind: 'gallery', order: i });
      }
    });
  }
  
  // Images array (alternate format)
  if (Array.isArray(details.images)) {
    details.images.forEach((img: any, i: number) => {
      const url = typeof img === 'string' ? img : img.url || img.image_url;
      if (url) {
        photos.push({ url, is_cover: false, kind: 'gallery', order: photos.length + i });
      }
    });
  }

  // Floor plans
  if (details.floor_plan?.url) {
    photos.push({ url: details.floor_plan.url, kind: 'floor_plan' });
  }
  if (Array.isArray(details.floor_plans)) {
    details.floor_plans.forEach((fp: any) => {
      const url = typeof fp === 'string' ? fp : fp.url;
      if (url) {
        photos.push({ url, kind: 'floor_plan' });
      }
    });
  }

  if (photos.length === 0) {
    return result;
  }

  for (const photo of photos) {
    try {
      let finalUrl = photo.url;
      let checksum: string | null = null;

      // Upload to Cloudinary if configured
      if (cloudinaryConfig) {
        try {
          const uploadResult = await uploadToCloudinary(
            photo.url,
            propertyId,
            photo.kind,
            cloudinaryConfig
          );
          if (uploadResult) {
            finalUrl = uploadResult.url;
            checksum = uploadResult.checksum;
          }
        } catch (e) {
          console.warn(`Cloudinary upload failed for ${photo.url}:`, e);
        }
      }

      // Check for duplicate by checksum if available
      if (checksum) {
        const { data: existingMedia } = await supabaseAdmin
          .from('property_media')
          .select('id')
          .eq('property_id', propertyId)
          .eq('checksum', checksum)
          .maybeSingle();

        if (existingMedia) {
          continue;
        }
      }

      // Insert media record
      await supabaseAdmin
        .from('property_media')
        .insert({
          property_id: propertyId,
          organization_id: organizationId,
          kind: photo.kind || 'gallery',
          original_url: photo.url,
          stored_url: finalUrl,
          storage_provider: cloudinaryConfig ? 'cloudinary' : 'external',
          checksum,
          display_order: photo.order || 0,
          is_processed: !!cloudinaryConfig,
        });

      result.processed++;
    } catch (e) {
      console.error(`Failed to process photo:`, e);
      result.failed++;
    }
  }

  return result;
}

async function uploadToCloudinary(
  imageUrl: string,
  propertyId: string,
  kind: string,
  config: { cloudinaryCloudName: string; cloudinaryApiKey: string; cloudinaryApiSecret: string }
): Promise<{ url: string; checksum: string } | null> {
  try {
    const imageResponse = await fetchWithTimeout(imageUrl, {}, 20000);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    const imageData = await imageResponse.arrayBuffer();
    const checksum = await generateChecksum(imageData);

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `properties/${propertyId}/imobzi/${kind}`;
    const publicId = `${folder}/${checksum}`;

    const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${config.cloudinaryApiSecret}`;
    const signatureBuffer = await crypto.subtle.digest(
      'SHA-1',
      new TextEncoder().encode(paramsToSign)
    );
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const formData = new FormData();
    formData.append('file', new Blob([imageData]));
    formData.append('api_key', config.cloudinaryApiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    formData.append('folder', folder);
    formData.append('public_id', publicId);

    const uploadResponse = await fetchWithTimeout(
      `https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      },
      45000
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Cloudinary upload failed: ${errorText}`);
    }

    const uploadData = await safeJson(uploadResponse);
    return {
      url: uploadData.secure_url,
      checksum,
    };
  } catch (e) {
    console.error('Cloudinary upload error:', e);
    return null;
  }
}

async function processOwnerData(
  supabaseAdmin: any,
  organizationId: string,
  propertyId: string,
  details: any
): Promise<void> {
  const owner = details.owner || details.proprietario || details.contact;
  if (!owner) return;

  const ownerName = owner.name || owner.nome;
  if (!ownerName) return;

  try {
    const { data: existingOwner } = await supabaseAdmin
      .from('property_owners')
      .select('id')
      .eq('property_id', propertyId)
      .eq('is_primary', true)
      .maybeSingle();

    const ownerData = {
      property_id: propertyId,
      organization_id: organizationId,
      name: ownerName,
      phone: owner.phone || owner.telefone || owner.mobile || null,
      email: owner.email || null,
      document: owner.document || owner.cpf || owner.cnpj || null,
      is_primary: true,
    };

    if (existingOwner) {
      await supabaseAdmin
        .from('property_owners')
        .update(ownerData)
        .eq('id', existingOwner.id);
    } else {
      await supabaseAdmin
        .from('property_owners')
        .insert(ownerData);
    }
  } catch (e) {
    console.warn('Failed to process owner data:', e);
  }
}

function mapPropertyData(raw: any, organizationId: string, userId: string) {
  const hasSale = raw.sale || (raw.sale_value && Number(raw.sale_value) > 0);
  const hasRent = raw.rent || (raw.rental_value && Number(raw.rental_value) > 0);
  const transactionType = 
    (hasSale && hasRent) ? 'venda_aluguel' :
    hasRent ? 'aluguel' :
    'venda';

  const status = mapStatus(raw.status);
  const launchStage = mapLaunchStage(raw.launch_stage || raw.stage);
  const propertyCondition = mapPropertyCondition(raw.condition || raw.property_condition);

  return {
    organization_id: organizationId,
    created_by: userId,
    
    title: raw.title || `Imóvel ${raw.code || raw.db_id}`,
    description: raw.description || raw.full_description || null,
    property_code: raw.code || raw.alternative_code || null,
    
    transaction_type: transactionType,
    status,
    
    sale_price: parseFloat(raw.sale_value) || null,
    rent_price: parseFloat(raw.rental_value) || null,
    condominium_fee: parseFloat(raw.condo_value || raw.condominium) || null,
    iptu: parseFloat(raw.iptu_value || raw.iptu) || null,
    iptu_monthly: parseFloat(raw.iptu_monthly) || null,
    inspection_fee: parseFloat(raw.inspection_fee) || null,
    
    address_street: raw.address || raw.street || null,
    address_number: raw.number || raw.street_number || null,
    address_complement: raw.complement || raw.address_complement || null,
    address_neighborhood: raw.neighborhood || raw.district || null,
    address_city: raw.city || null,
    address_state: raw.state || null,
    address_zipcode: raw.zipcode || raw.zip_code || raw.cep || null,
    
    latitude: parseFloat(raw.latitude) || null,
    longitude: parseFloat(raw.longitude) || null,
    
    bedrooms: parseInt(raw.bedroom || raw.bedrooms) || null,
    bathrooms: parseInt(raw.bathroom || raw.bathrooms) || null,
    suites: parseInt(raw.suite || raw.suites) || null,
    parking_spots: parseInt(raw.garage || raw.parking_spots || raw.garages) || null,
    area_total: parseFloat(raw.useful_area || raw.total_area || raw.area) || null,
    area_built: parseFloat(raw.built_area || raw.private_area) || null,
    floor: parseInt(raw.floor) || null,
    
    amenities: extractAmenities(raw),
    
    development_name: raw.development_name || raw.building_name || raw.condominium_name || null,
    launch_stage: launchStage,
    property_condition: propertyCondition,
    
    source_provider: 'imobzi',
    source_property_id: String(raw.db_id || raw.property_id || raw.id),
    source_code: raw.code || raw.alternative_code || null,
    source_status: raw.status || null,
    source_key_id: raw.key_id || null,
    
    raw_payload: raw,
    imobzi_updated_at: raw.updated_at || null,
  };
}

function extractAmenities(raw: any): string[] {
  const amenities: string[] = [];
  
  if (Array.isArray(raw.features)) {
    amenities.push(...raw.features.filter((f: any) => typeof f === 'string'));
  }
  
  if (Array.isArray(raw.amenities)) {
    amenities.push(...raw.amenities.filter((a: any) => typeof a === 'string'));
  }
  
  const booleanFeatures: Record<string, string> = {
    'has_pool': 'Piscina',
    'pool': 'Piscina',
    'has_gym': 'Academia',
    'gym': 'Academia',
    'has_barbecue': 'Churrasqueira',
    'barbecue': 'Churrasqueira',
    'furnished': 'Mobiliado',
    'is_furnished': 'Mobiliado',
    'accepts_pets': 'Aceita Animais',
    'pet_friendly': 'Aceita Animais',
    'has_elevator': 'Elevador',
    'elevator': 'Elevador',
    'has_doorman': 'Portaria 24h',
    'doorman': 'Portaria 24h',
    'has_balcony': 'Varanda',
    'balcony': 'Varanda',
    'accepts_financing': 'Aceita Financiamento',
    'financing': 'Aceita Financiamento',
  };
  
  for (const [key, label] of Object.entries(booleanFeatures)) {
    if (raw[key] === true) {
      amenities.push(label);
    }
  }
  
  return [...new Set(amenities)];
}

function mapStatus(imobziStatus: string | undefined): string {
  const statusMap: Record<string, string> = {
    'available': 'disponivel',
    'disponivel': 'disponivel',
    'sold': 'vendido',
    'vendido': 'vendido',
    'rented': 'alugado',
    'alugado': 'alugado',
    'suspended': 'suspenso',
    'suspenso': 'suspenso',
    'inactive': 'inativo',
    'inativo': 'inativo',
    'reserved': 'reservado',
    'reservado': 'reservado',
    'proposal': 'com_proposta',
    'com_proposta': 'com_proposta',
  };
  return statusMap[imobziStatus?.toLowerCase() || ''] || 'disponivel';
}

function mapLaunchStage(stage: string | undefined): string | null {
  if (!stage) return null;
  const stageMap: Record<string, string> = {
    'ready': 'pronto',
    'pronto': 'pronto',
    'construction': 'em_obras',
    'em_obras': 'em_obras',
    'launch': 'lancamento',
    'lancamento': 'lancamento',
    'future': 'futuro',
    'futuro': 'futuro',
  };
  return stageMap[stage.toLowerCase()] || null;
}

function mapPropertyCondition(condition: string | undefined): string | null {
  if (!condition) return null;
  const conditionMap: Record<string, string> = {
    'new': 'novo',
    'novo': 'novo',
    'used': 'usado',
    'usado': 'usado',
  };
  return conditionMap[condition.toLowerCase()] || null;
}

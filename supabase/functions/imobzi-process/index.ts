import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceUsageLimit, trackUsageEvent } from "../_shared/usage-governor.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const IMOBZI_API_BASE = 'https://api.imobzi.app/v1';
const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1';

// ===== TUNED CONFIGURATION =====
const CHUNK_SIZE = 3;              // 3 properties per invocation (safe for 150s limit)
const IMAGE_CONCURRENCY = 3;       // 3 images downloaded/uploaded in parallel
const IMAGE_TIMEOUT_MS = 30_000;   // 30s per image (was 45s)
const TIMEOUT_GUARD_MS = 120_000;  // 120s guard - stop processing and chain before 150s limit

const STAGE_MAP: Record<string, string> = {
  ready: 'pronto',
  under_construction: 'em_construcao',
  building: 'em_construcao',
  future: 'futuro',
  launch: 'futuro',
};

async function sha1(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizeStringArray(input: unknown): string[] {
  if (input == null) return [];
  if (Array.isArray(input)) return input.map((v) => String(v)).map((s) => s.trim()).filter(Boolean);
  if (typeof input === 'string') return input.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function getPrimaryPhone(input: unknown): string | null {
  if (input == null) return null;
  if (Array.isArray(input)) return input.length ? String(input[0]) : null;
  if (typeof input === 'string') return input;
  return null;
}

function extractPhotosArray(details: any): Array<{ url?: string; position?: number; category?: string }> {
  const photosRaw = details.photos;
  let photos: Array<{ url?: string; position?: number; category?: string }> = [];

  if (Array.isArray(photosRaw)) {
    photos = photosRaw;
  } else if (photosRaw && typeof photosRaw === 'object') {
    const nested = (photosRaw as Record<string, unknown>).photos;
    if (Array.isArray(nested)) {
      photos = nested;
    }
  }

  if (photos.length === 0 && details.cover_photo?.url) {
    photos.push({ url: details.cover_photo.url, position: 0 });
  }

  return photos;
}

// ===== API CALLS =====

async function fetchPropertyDetails(propertyId: string, apiKey: string): Promise<any> {
  const url = `${IMOBZI_API_BASE}/property/${propertyId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'X-IMOBZI-SECRET': apiKey, 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API ${response.status}: ${errorText.substring(0, 200)}`);
  }
  return await response.json();
}

async function downloadImage(imageUrl: string): Promise<{ data: ArrayBuffer; checksum: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
    const response = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.arrayBuffer();
    const checksum = await sha256(data);
    return { data, checksum };
  } catch {
    return null;
  }
}

async function uploadToCloudinary(
  imageData: ArrayBuffer, propertyId: string, imageIndex: number,
  cloudName: string, apiKey: string, apiSecret: string
): Promise<string | null> {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `properties/${propertyId}/imobzi`;
    const params: Record<string, string | number> = { folder, timestamp };
    const sortedParams = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
    const signature = await sha1(sortedParams + apiSecret);

    const formData = new FormData();
    formData.append('file', new Blob([imageData]), `image_${imageIndex}.jpg`);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    formData.append('folder', folder);

    const response = await fetch(`${CLOUDINARY_UPLOAD_URL}/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) return null;
    const result = await response.json();
    return result.secure_url;
  } catch {
    return null;
  }
}

// ===== PARALLEL IMAGE PROCESSING =====

async function processImageBatch(
  photos: Array<{ url?: string; position?: number; category?: string }>,
  propertyDbId: string,
  supabase: ReturnType<typeof createClient>,
  cloudinaryConfig: { cloudName: string; apiKey: string; apiSecret: string }
): Promise<number> {
  // Delete existing images first
  await supabase.from('property_images').delete().eq('property_id', propertyDbId);
  let imagesImported = 0;

  // Process in parallel batches of IMAGE_CONCURRENCY
  for (let i = 0; i < photos.length; i += IMAGE_CONCURRENCY) {
    const batch = photos.slice(i, i + IMAGE_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (photo, batchIdx) => {
        const globalIdx = i + batchIdx;
        if (!photo.url) return false;

        const downloaded = await downloadImage(photo.url);
        if (!downloaded) return false;

        const cloudinaryUrl = await uploadToCloudinary(
          downloaded.data, propertyDbId, globalIdx,
          cloudinaryConfig.cloudName, cloudinaryConfig.apiKey, cloudinaryConfig.apiSecret
        );
        if (!cloudinaryUrl) return false;

        let imageType: 'photo' | 'floor_plan' | 'video_thumbnail' = 'photo';
        if (photo.category?.toLowerCase().includes('planta')) imageType = 'floor_plan';

        const { error: imgErr } = await supabase.from('property_images').insert({
          property_id: propertyDbId,
          url: cloudinaryUrl,
          display_order: photo.position ?? globalIdx,
          is_cover: globalIdx === 0,
          image_type: imageType,
          source: 'imobzi',
        });
        return !imgErr;
      })
    );
    imagesImported += results.filter(Boolean).length;
  }

  return imagesImported;
}

// ===== MARKETPLACE PUBLISH =====

async function publishToMarketplace(
  propertyDbId: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  try {
    // Fetch full property data
    const { data: prop, error: propErr } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyDbId)
      .single();
    if (propErr || !prop) return;

    // Fetch images
    const { data: images } = await supabase
      .from('property_images')
      .select('url, is_cover')
      .eq('property_id', propertyDbId)
      .order('display_order');

    const imageUrls = (images || []).map((img: any) => img.url);

    // Fetch primary owner
    const { data: owner } = await supabase
      .from('property_owners')
      .select('name, phone, email')
      .eq('property_id', propertyDbId)
      .eq('is_primary', true)
      .maybeSingle();

    await supabase
      .from('marketplace_properties')
      .upsert({
        id: propertyDbId,
        title: prop.title,
        description: prop.description,
        property_type_id: prop.property_type_id,
        transaction_type: prop.transaction_type,
        sale_price: prop.sale_price,
        rent_price: prop.rent_price,
        address_street: prop.address_street,
        address_number: prop.address_number,
        address_complement: prop.address_complement,
        address_neighborhood: prop.address_neighborhood,
        address_city: prop.address_city,
        address_state: prop.address_state,
        address_zipcode: prop.address_zipcode,
        bedrooms: prop.bedrooms || 0,
        suites: prop.suites || 0,
        bathrooms: prop.bathrooms || 0,
        parking_spots: prop.parking_spots || 0,
        area_total: prop.area_total,
        area_built: prop.area_built,
        amenities: prop.amenities,
        images: imageUrls,
        owner_name: owner?.name || null,
        owner_phone: owner?.phone || null,
        owner_email: owner?.email || null,
        status: prop.status,
        external_code: prop.property_code || null,
        commission_percentage: prop.commission_value || null,
        is_featured: false,
        organization_id: prop.organization_id,
      }, { onConflict: 'id' });

    console.log(`[PROCESS] 🏪 Published ${propertyDbId} to marketplace`);
  } catch (e) {
    console.error(`[PROCESS] ⚠ Marketplace publish failed for ${propertyDbId}:`, (e as Error).message);
  }
}

// ===== CORE: Process a single property =====

async function processProperty(
  propertyId: string, apiKey: string, organizationId: string, userId: string,
  runId: string, supabase: ReturnType<typeof createClient>,
  cloudinaryConfig: { cloudName: string; apiKey: string; apiSecret: string },
  marketplacePropertyIds: string[] = []
): Promise<{ status: 'success' | 'error'; imagesImported: number; error?: string }> {
  
  const pid = String(propertyId);
  
  try {
    // Mark item as processing
    await supabase
      .from('import_run_items')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('run_id', runId)
      .eq('source_property_id', pid);

    const details = await fetchPropertyDetails(propertyId, apiKey);

    // Build property data
    const salePrice = details.sale_value || details.sale || 0;
    const rentPrice = details.rental_value || 0;
    let transactionType: 'venda' | 'aluguel' | 'ambos' = 'venda';
    if (salePrice > 0 && rentPrice > 0) transactionType = 'ambos';
    else if (rentPrice > 0 && salePrice === 0) transactionType = 'aluguel';

    const launchStage = STAGE_MAP[details.stage ?? ''] ?? 'nenhum';
    const conditionRaw = details.fields?.custom_imovel_novousado?.toLowerCase();
    let propertyCondition: 'novo' | 'usado' | null = null;
    if (conditionRaw === 'novo') propertyCondition = 'novo';
    else if (conditionRaw === 'usado' || details.situation === 'with_deed') propertyCondition = 'usado';

    const areaTotal = details.useful_area || details.area || details.lot_area || null;
    const parts: string[] = [];
    if (details.property_type) parts.push(details.property_type);
    if (details.bedroom && details.bedroom > 0) parts.push(`${details.bedroom}Q`);
    if (details.neighborhood) parts.push(details.neighborhood);
    const title = parts.length > 0 ? parts.join(' - ') : `Imóvel ${details.code || details.db_id}`;

    const photos = extractPhotosArray(details);
    const importWarnings: Record<string, boolean> = {};
    if (!areaTotal) importWarnings.metragem_ausente = true;
    if (photos.length === 0) importWarnings.fotos_ausentes = true;
    if (!details.owners || details.owners.length === 0) importWarnings.sem_proprietario = true;

    const propertyData = {
      title,
      organization_id: organizationId,
      created_by: userId,
      source_provider: 'imobzi',
      source_property_id: String(details.db_id),
      source_code: details.code,
      source_status: details.status,
      transaction_type: transactionType,
      sale_price: salePrice || null,
      rent_price: rentPrice || null,
      condominium_fee: details.condominium || null,
      iptu: details.iptu || null,
      latitude: details.latitude,
      longitude: details.longitude,
      address_street: details.address,
      address_complement: details.address_complement,
      address_neighborhood: details.neighborhood,
      address_city: details.city,
      address_state: details.state,
      address_zipcode: details.zipcode,
      area_total: areaTotal,
      bedrooms: details.bedroom ?? 0,
      bathrooms: details.bathroom ?? 0,
      suites: details.suite ?? 0,
      parking_spots: details.garage ?? 0,
      development_name: details.building_name,
      floor: details.unit_floor,
      launch_stage: launchStage,
      property_condition: propertyCondition,
      amenities: normalizeStringArray(details.features),
      status: 'disponivel',
      raw_payload: details,
      import_status: Object.keys(importWarnings).length > 0 ? 'incomplete' : 'complete',
      import_warnings: Object.keys(importWarnings).length > 0 ? importWarnings : null,
      updated_at: new Date().toISOString(),
    };

    // Upsert property (first check by source_provider + source_property_id)
    const { data: existingProperty } = await supabase
      .from('properties')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('source_provider', 'imobzi')
      .eq('source_property_id', String(details.db_id))
      .maybeSingle();

    let propertyDbId: string;

    if (existingProperty?.id) {
      const { error: updateError } = await supabase
        .from('properties')
        .update(propertyData)
        .eq('id', existingProperty.id);
      if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
      propertyDbId = existingProperty.id;
    } else {
      // Check for address-based duplicate before inserting
      if (details.address) {
        const normalizedStreet = (details.address || '').toLowerCase().trim()
          .replace(/\b(rua|r\.|av\.|avenida|alameda|al\.|travessa|tv\.)\b/gi, '').trim();
        const normalizedNumber = (details.address_number || '').replace(/\D/g, '');
        
        if (normalizedStreet) {
          const { data: addressDuplicates } = await supabase
            .from('properties')
            .select('id, address_street, address_number')
            .eq('organization_id', organizationId)
            .not('address_street', 'is', null);

          const hasDuplicate = (addressDuplicates || []).some(p => {
            const pStreet = (p.address_street || '').toLowerCase().trim()
              .replace(/\b(rua|r\.|av\.|avenida|alameda|al\.|travessa|tv\.)\b/gi, '').trim();
            const pNumber = (p.address_number || '').replace(/\D/g, '');
            const streetMatch = pStreet.includes(normalizedStreet) || normalizedStreet.includes(pStreet);
            if (normalizedNumber && pNumber) return streetMatch && pNumber === normalizedNumber;
            return streetMatch;
          });

          if (hasDuplicate) {
            importWarnings.endereco_duplicado = true;
            console.log(`[PROCESS] ⚠ Address duplicate detected for ${pid}: ${details.address} ${details.address_number || ''}`);
          }
        }
      }

      const { data: newProperty, error: insertError } = await supabase
        .from('properties')
        .insert({
          ...propertyData,
          import_warnings: Object.keys(importWarnings).length > 0 ? importWarnings : null,
          import_status: Object.keys(importWarnings).length > 0 ? 'incomplete' : 'complete',
        })
        .select('id')
        .single();
      if (insertError) throw new Error(`DB insert failed: ${insertError.message}`);
      propertyDbId = newProperty.id;
    }

    // Process images IN PARALLEL
    const imagesImported = await processImageBatch(photos, propertyDbId, supabase, cloudinaryConfig);

    // Handle owners
    if (details.owners && details.owners.length > 0) {
      await supabase.from('property_owners').delete().eq('property_id', propertyDbId);
      for (let i = 0; i < details.owners.length; i++) {
        const owner = details.owners[i];
        // Extract phone number from phones array of objects [{number: "...", type: "..."}]
        let ownerPhone: string | null = null;
        if (Array.isArray(owner.phones) && owner.phones.length > 0) {
          const phoneObj = owner.phones[0];
          ownerPhone = typeof phoneObj === 'object' && phoneObj?.number ? phoneObj.number : (typeof phoneObj === 'string' ? phoneObj : null);
        } else if (typeof owner.phones === 'string') {
          ownerPhone = owner.phones;
        }
        // Extract email from array or string
        let ownerEmail: string | null = null;
        if (Array.isArray(owner.email)) {
          const validEmail = owner.email.find((e: string) => e && e.trim().length > 0);
          ownerEmail = validEmail || null;
        } else if (typeof owner.email === 'string' && owner.email.trim().length > 0) {
          ownerEmail = owner.email;
        }
        await supabase.from('property_owners').insert({
          property_id: propertyDbId,
          organization_id: organizationId,
          name: owner.name || owner.full_name || 'Proprietário',
          phone: ownerPhone,
          email: ownerEmail,
          document: owner.cpf || owner.document || null,
          is_primary: i === 0,
        });
      }
    }

    // Mark item as complete
    await supabase
      .from('import_run_items')
      .update({
        status: 'complete',
        property_id: propertyDbId,
        photos_imported: imagesImported,
        photos_expected: photos.length,
        detail_fetched: true,
        updated_at: new Date().toISOString(),
      })
      .eq('run_id', runId)
      .eq('source_property_id', pid);

    // Publish to marketplace if requested
    if (marketplacePropertyIds.includes(pid)) {
      await publishToMarketplace(propertyDbId, supabase);
    }

    console.log(`[PROCESS] ✅ ${pid} done (${imagesImported}/${photos.length} imgs)`);
    return { status: 'success', imagesImported };

  } catch (error) {
    telemetry.responseStatus = telemetry.responseStatus ?? 500;
    const err = error as Error;
    console.error(`[PROCESS] ❌ ${pid}: ${err.message}`);

    await supabase
      .from('import_run_items')
      .update({
        status: 'error',
        error_message: err.message.substring(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('run_id', runId)
      .eq('source_property_id', pid);

    return { status: 'error', imagesImported: 0, error: err.message };
  }
}

// ===== PROGRESS: Single batch update at end of chunk =====

async function updateRunProgressBatch(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  chunkSuccess: number,
  chunkErrors: number,
  chunkImages: number
) {
  // Use a single query to get current totals
  const { data: run } = await supabase
    .from('import_runs')
    .select('imported, errors, images_processed')
    .eq('id', runId)
    .single();

  const newImported = (run?.imported || 0) + chunkSuccess;
  const newErrors = (run?.errors || 0) + chunkErrors;
  const newImages = (run?.images_processed || 0) + chunkImages;

  const { error } = await supabase
    .from('import_runs')
    .update({
      imported: newImported,
      errors: newErrors,
      images_processed: newImages,
    })
    .eq('id', runId);

  if (error) {
    console.error(`[PROCESS] ⚠ Progress update failed:`, error.message);
  } else {
    console.log(`[PROCESS] 📊 Progress: ${newImported} ok, ${newErrors} err, ${newImages} imgs`);
  }
}

// ===== MAIN HANDLER =====

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const telemetry: { userId?: string; organizationId?: string | null; blockedReason?: string | null; responseStatus?: number } = {};
  console.log('[PROCESS] ========== INVOCATION START ==========');

  try {
    // Validate JWT - ensure only authenticated users can trigger processing
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the token is valid (can be service role for chaining or user token)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    // Allow service role tokens (used for chaining)
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const isServiceRole = token === supabaseServiceKey;
    
    if (!isServiceRole) {
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const body = await req.json();
    const { api_key, run_id } = body;

    if (!api_key || !run_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server misconfigured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // AH-01: Resolve caller identity from JWT, not from body
    let callerUserId: string;
    if (isServiceRole) {
      // Service role chaining — trust run_id ownership (already validated on first call)
      const { data: runOwner } = await supabase
        .from('import_runs')
        .select('organization_id')
        .eq('id', run_id)
        .single();
      if (!runOwner) {
        return new Response(
          JSON.stringify({ success: false, error: 'Run not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // For chaining, we get user_id from profiles linked to this org (first admin/creator)
      const { data: orgProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('organization_id', runOwner.organization_id)
        .limit(1)
        .single();
      callerUserId = orgProfile?.user_id || '';
    } else {
      const { data: claimsData } = await authClient.auth.getClaims(token);
      callerUserId = claimsData?.claims?.sub as string || '';
    }

    // AH-01: Validate run_id ownership via RPC
    if (!isServiceRole) {
      const { data: accessOk, error: accessErr } = await supabase
        .rpc('assert_import_run_access', { p_run_id: run_id, p_user_id: callerUserId });
      if (accessErr || !accessOk) {
        console.error(`[PROCESS] 🚫 Access denied: user=${callerUserId} run=${run_id}`);
        return new Response(
          JSON.stringify({ success: false, error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Resolve organization_id and user_id from run, not from body
    const { data: runMeta, error: runMetaErr } = await supabase
      .from('import_runs')
      .select('organization_id, status, marketplace_property_ids')
      .eq('id', run_id)
      .single();

    if (runMetaErr || !runMeta) {
      return new Response(
        JSON.stringify({ success: false, error: 'Run not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organization_id = runMeta.organization_id;
    const user_id = callerUserId;
    telemetry.userId = user_id;
    telemetry.organizationId = organization_id;

    const limitResult = await enforceUsageLimit({
      supabase,
      functionName: 'imobzi-process',
      userId: user_id,
      organizationId: organization_id,
      metadata: { run_id },
    });
    if (!limitResult.allowed) {
      telemetry.blockedReason = limitResult.reason;
      telemetry.responseStatus = 429;
      return new Response(
        JSON.stringify({ success: false, error: 'Limite de uso excedido', reason: limitResult.reason, retry_after: limitResult.retryAfterSeconds }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(limitResult.retryAfterSeconds) } }
      );
    }

    const runCheck = runMeta;


    if (runCheck?.status === 'cancelled' || runCheck?.status === 'failed' || runCheck?.status === 'completed') {
      console.log(`[PROCESS] Run is ${runCheck.status}, skipping`);
      telemetry.responseStatus = 200;
      return new Response(
        JSON.stringify({ success: true, message: `Run already ${runCheck.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ATOMIC CLAIM: Use DB function to safely pop N property IDs with row locking
    // This prevents race conditions when multiple invocations run in parallel
    const { data: claimedIds, error: claimErr } = await supabase
      .rpc('claim_import_chunk', { p_run_id: run_id, p_chunk_size: CHUNK_SIZE });

    if (claimErr) {
      console.error(`[PROCESS] ❌ Claim failed: ${claimErr.message}`);
      return new Response(
        JSON.stringify({ success: false, error: `Claim failed: ${claimErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allPropertyIds = (claimedIds || []).map(String);
    
    if (allPropertyIds.length === 0) {
      console.log('[PROCESS] No pending properties, finalizing');
      await supabase.from('import_runs').update({
        status: 'completed',
        finished_at: new Date().toISOString(),
      }).eq('id', run_id);
      
      telemetry.responseStatus = 200;
      return new Response(
        JSON.stringify({ success: true, message: 'All done' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cloudinary config
    const cloudinaryConfig = {
      cloudName: Deno.env.get('CLOUDINARY_CLOUD_NAME') || '',
      apiKey: Deno.env.get('CLOUDINARY_API_KEY') || '',
      apiSecret: Deno.env.get('CLOUDINARY_API_SECRET') || '',
    };

    if (!cloudinaryConfig.cloudName || !cloudinaryConfig.apiKey || !cloudinaryConfig.apiSecret) {
      await supabase.from('import_runs').update({
        status: 'failed',
        error_message: 'Cloudinary não configurado',
        finished_at: new Date().toISOString(),
      }).eq('id', run_id);
      return new Response(
        JSON.stringify({ success: false, error: 'Cloudinary not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set run status to processing
    await supabase.from('import_runs').update({ status: 'processing' }).eq('id', run_id);

    const marketplacePropertyIds: string[] = runCheck?.marketplace_property_ids || [];
    if (marketplacePropertyIds.length > 0) {
      console.log(`[PROCESS] 🏪 Marketplace publish requested for ${marketplacePropertyIds.length} properties`);
    }

    console.log(`[PROCESS] Processing chunk of up to ${CHUNK_SIZE} from ${allPropertyIds.length} pending`);

    // ===== PROCESS PROPERTIES WITH TIMEOUT GUARD =====
    let processed = 0;
    let chunkSuccess = 0;
    let chunkErrors = 0;
    let chunkImages = 0;

    for (let j = 0; j < Math.min(CHUNK_SIZE, allPropertyIds.length); j++) {
      // TIMEOUT GUARD: if we've used 120s, stop and chain
      const elapsed = Date.now() - startTime;
      if (elapsed > TIMEOUT_GUARD_MS) {
        console.log(`[PROCESS] ⏱ Timeout guard triggered at ${elapsed}ms after ${processed} properties`);
        break;
      }

      const propertyId = allPropertyIds[j];
      const result = await processProperty(
        propertyId, api_key, organization_id, user_id, run_id, supabase, cloudinaryConfig, marketplacePropertyIds
      );

      processed++;
      if (result.status === 'success') {
        chunkSuccess++;
        chunkImages += result.imagesImported;
      } else {
        chunkErrors++;
      }
    }

    // ===== UPDATE PROGRESS ONCE for the entire chunk =====
    await updateRunProgressBatch(supabase, run_id, chunkSuccess, chunkErrors, chunkImages);

    // ===== CHECK IF MORE PENDING (IDs already removed atomically by claim_import_chunk) =====
    // Check if there are still pending items
    const { data: remainingCheck } = await supabase
      .from('import_runs')
      .select('pending_property_ids')
      .eq('id', run_id)
      .single();

    const hasRemaining = remainingCheck?.pending_property_ids && remainingCheck.pending_property_ids.length > 0;
    const remainingCount = remainingCheck?.pending_property_ids?.length || 0;

    if (hasRemaining) {
      console.log(`[PROCESS] ${processed} done this chunk, ${remainingCount} remaining. Chaining...`);

      // ===== FIRE-AND-FORGET CHAIN =====
      const functionUrl = `${supabaseUrl}/functions/v1/imobzi-process`;
      // AH-01: Chain only passes api_key and run_id; org/user resolved from DB
      const chainPromise = fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ api_key, run_id }),
      }).then(r => {
        console.log(`[PROCESS] Chain response: ${r.status}`);
      }).catch(e => {
        console.error(`[PROCESS] ❌ Chain failed: ${(e as Error).message}`);
      });

      EdgeRuntime.waitUntil(chainPromise);
    } else {
      // All done - finalize
      const { data: finalRun } = await supabase
        .from('import_runs')
        .select('imported, errors')
        .eq('id', run_id)
        .single();

      const finalStatus = (finalRun?.imported === 0 && (finalRun?.errors || 0) > 0) ? 'failed' : 'completed';
      
      await supabase.from('import_runs').update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        pending_property_ids: null,
      }).eq('id', run_id);

      console.log(`[PROCESS] ✅ ALL DONE: ${finalRun?.imported} success, ${finalRun?.errors} errors`);
    }

    const totalElapsed = Date.now() - startTime;
    console.log(`[PROCESS] ========== INVOCATION END (${totalElapsed}ms) ==========`);

    telemetry.responseStatus = 200;
    return new Response(
      JSON.stringify({
        success: true,
        run_id,
        processed,
        remaining: remainingCount,
        elapsed_ms: totalElapsed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    telemetry.responseStatus = telemetry.responseStatus ?? 500;
    const err = error as Error;
    console.error('[PROCESS] ❌ TOP-LEVEL ERROR:', err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } finally {
    if (telemetry.userId) {
      const metricsClient = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
      await trackUsageEvent({
        supabase: metricsClient,
        functionName: 'imobzi-process',
        userId: telemetry.userId,
        organizationId: telemetry.organizationId,
        allowed: !telemetry.blockedReason,
        reason: telemetry.blockedReason ?? null,
        responseStatus: telemetry.responseStatus,
        durationMs: Date.now() - startTime,
      });
    }
  }
});

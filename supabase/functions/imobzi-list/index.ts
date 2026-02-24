import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const IMOBZI_API_BASE = 'https://api.imobzi.app/v1';

interface ImobziProperty {
  db_id: number;
  property_id: string;
  code?: string;
  property_type?: string;
  address?: string;
  city?: string;
  neighborhood?: string;
  state?: string;
  sale_value?: number;
  rental_value?: number;
  bedroom?: number;
  bathroom?: number;
  suite?: number;
  garage?: number;
  area?: number;
  useful_area?: number;
  building_name?: string;
  cover_photo?: {
    db_id: number;
    url?: string;
  };
  links?: {
    site_url?: string;
  };
}

interface PropertyPreview {
  property_id: string;
  title: string;
  code?: string;
  property_type?: string;
  cover_photo?: string;
  site_url?: string;
  address_city?: string;
  address_neighborhood?: string;
  address_street?: string;
  sale_price?: number;
  rent_price?: number;
  bedrooms?: number;
  bathrooms?: number;
  suites?: number;
  parking_spots?: number;
  area_total?: number;
  building_name?: string;
}

interface PageResult {
  properties: ImobziProperty[];
  cursor?: string;
  count: number;
}

function extractPropertiesFromResponse(data: unknown): { properties: ImobziProperty[], cursor?: string, count: number } {
  if (!data || typeof data !== 'object') {
    return { properties: [], count: 0 };
  }

  const response = data as Record<string, unknown>;
  const cursor = response.cursor as string | undefined;
  const count = (response.count as number) || 0;

  // Try different possible field names
  const possibleFields = ['properties_map', 'properties', 'data', 'items', 'results'];
  
  for (const field of possibleFields) {
    if (response[field] && Array.isArray(response[field])) {
      return { properties: response[field] as ImobziProperty[], cursor, count };
    }
  }

  // If the response itself is an array
  if (Array.isArray(data)) {
    return { properties: data as ImobziProperty[], cursor, count };
  }

  // Check nested structure
  if (response.data && typeof response.data === 'object') {
    const nestedData = response.data as Record<string, unknown>;
    for (const field of possibleFields) {
      if (nestedData[field] && Array.isArray(nestedData[field])) {
        return { properties: nestedData[field] as ImobziProperty[], cursor, count };
      }
    }
  }

  return { properties: [], cursor, count };
}

function mapProperty(prop: ImobziProperty): PropertyPreview {
  const parts: string[] = [];
  if (prop.property_type) parts.push(prop.property_type);
  if (prop.bedroom && prop.bedroom > 0) parts.push(`${prop.bedroom}Q`);
  if (prop.neighborhood) parts.push(prop.neighborhood);
  
  const title = parts.length > 0 ? parts.join(' - ') : `Imóvel ${prop.code || prop.db_id}`;

  let coverPhoto: string | undefined;
  if (prop.cover_photo?.url && prop.cover_photo.url !== '') {
    coverPhoto = prop.cover_photo.url;
  }

  return {
    property_id: String(prop.db_id || prop.property_id),
    title,
    code: prop.code,
    property_type: prop.property_type,
    cover_photo: coverPhoto,
    site_url: prop.links?.site_url,
    address_city: prop.city,
    address_neighborhood: prop.neighborhood,
    address_street: prop.address,
    sale_price: prop.sale_value || undefined,
    rent_price: prop.rental_value || undefined,
    bedrooms: prop.bedroom,
    bathrooms: prop.bathroom,
    suites: prop.suite,
    parking_spots: prop.garage,
    area_total: prop.useful_area || prop.area,
    building_name: prop.building_name,
  };
}

async function fetchPage(apiKey: string, cursor?: string): Promise<PageResult> {
  const url = new URL(`${IMOBZI_API_BASE}/properties`);
  url.searchParams.set('smart_list', 'available');
  // Imobzi supports higher page sizes; default is small (10). This speeds up large listings a lot.
  url.searchParams.set('limit', '50');
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-IMOBZI-SECRET': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Imobzi API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return extractPropertiesFromResponse(data);
}

async function fetchAllProperties(apiKey: string): Promise<PropertyPreview[]> {
  const allProperties: PropertyPreview[] = [];
  const maxPages = 150;
  const CONCURRENT_PAGES = 5; // Fetch 5 pages at a time
  
  console.log('[imobzi-list] Starting optimized parallel fetch');
  const startTime = Date.now();

  // First, get the initial page to understand pagination
  const firstPage = await fetchPage(apiKey);
  const totalCount = firstPage.count;
  
  console.log(`[imobzi-list] Total properties reported: ${totalCount}`);
  
  // Add first page properties
  for (const prop of firstPage.properties) {
    allProperties.push(mapProperty(prop));
  }

  if (!firstPage.cursor) {
    console.log(`[imobzi-list] Only one page, returning ${allProperties.length} properties`);
    return allProperties;
  }

  // Sequential fetch with minimal delay (API seems to return 10 per page)
  let currentCursor: string | undefined = firstPage.cursor;
  let pageCount = 1;

  while (currentCursor && pageCount < maxPages) {
    pageCount++;
    
    try {
      const pageResult = await fetchPage(apiKey, currentCursor);
      
      for (const prop of pageResult.properties) {
        allProperties.push(mapProperty(prop));
      }
      
      currentCursor = pageResult.cursor;
      
      // Log progress every 20 pages
      if (pageCount % 20 === 0) {
        console.log(`[imobzi-list] Progress: ${allProperties.length} properties fetched in ${pageCount} pages`);
      }
      
      // Minimal delay to avoid rate limiting (50ms instead of 200ms)
      if (currentCursor) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error(`[imobzi-list] Error on page ${pageCount}:`, error);
      // Continue with what we have
      break;
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[imobzi-list] Completed: ${allProperties.length} properties in ${pageCount} pages, ${elapsed}ms`);
  
  return allProperties;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate JWT - ensure only authenticated users can call this
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const user = { id: claimsData.claims.sub as string };

    const body = await req.json();
    const { api_key } = body;

    if (!api_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'api_key is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[imobzi-list] Request received from user ${user.id}`);
    const properties = await fetchAllProperties(api_key);

    return new Response(
      JSON.stringify({
        success: true,
        properties,
        total: properties.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const err = error as Error;
    console.error('[imobzi-list] Error:', err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

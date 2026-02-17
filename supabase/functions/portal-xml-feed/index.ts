import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Content-Type': 'application/xml; charset=UTF-8',
};

// ===== Property Type Mapping for VRSync =====
const PROPERTY_TYPE_MAP: Record<string, string> = {
  'apartamento': 'Residential / Apartment',
  'casa': 'Residential / Home',
  'casa de condomínio': 'Residential / Condo',
  'cobertura': 'Residential / Penthouse',
  'flat': 'Residential / Flat',
  'kitnet': 'Residential / Kitnet',
  'studio': 'Residential / Studio',
  'sobrado': 'Residential / Sobrado',
  'terreno': 'Residential / Land Lot',
  'lote': 'Residential / Land Lot',
  'fazenda': 'Residential / Agricultural',
  'sítio': 'Residential / Agricultural',
  'chácara': 'Residential / Farm Ranch',
  'sala comercial': 'Commercial / Office',
  'loja': 'Commercial / Business',
  'galpão': 'Commercial / Industrial',
  'prédio comercial': 'Commercial / Building',
  'hotel': 'Commercial / Hotel',
  'garagem': 'Commercial / Garage',
};

const STATE_ABBREVIATIONS: Record<string, string> = {
  'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amazonas': 'AM',
  'bahia': 'BA', 'ceará': 'CE', 'distrito federal': 'DF', 'espírito santo': 'ES',
  'goiás': 'GO', 'maranhão': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', 'pará': 'PA', 'paraíba': 'PB', 'paraná': 'PR',
  'pernambuco': 'PE', 'piauí': 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN',
  'rio grande do sul': 'RS', 'rondônia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC',
  'são paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO',
};

function escapeXml(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function cdata(str: string | null | undefined): string {
  if (!str) return '';
  return `<![CDATA[${str.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function getStateAbbr(state: string | null): string {
  if (!state) return '';
  if (state.length === 2) return state.toUpperCase();
  return STATE_ABBREVIATIONS[state.toLowerCase().trim()] || state;
}

function getTransactionType(tt: string): string {
  if (tt === 'venda') return 'For Sale';
  if (tt === 'aluguel') return 'For Rent';
  return 'Sale/Rent';
}

function mapPropertyType(typeName: string | null): string {
  if (!typeName) return 'Residential / Apartment';
  const normalized = typeName.toLowerCase().trim();
  return PROPERTY_TYPE_MAP[normalized] || 'Residential / Apartment';
}

interface PropertyData {
  id: string;
  title: string | null;
  property_code: string | null;
  description: string | null;
  transaction_type: string;
  sale_price: number | null;
  rent_price: number | null;
  condominium_fee: number | null;
  iptu: number | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  area_total: number | null;
  area_built: number | null;
  area_useful: number | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zipcode: string | null;
  latitude: number | null;
  longitude: number | null;
  amenities: string[] | null;
  youtube_url: string | null;
  status: string;
  property_type_name: string | null;
  images: { url: string; is_cover: boolean }[];
}

// ===== VRSync XML (OLX/ZAP/VivaReal) =====
function generateVrSyncXml(properties: PropertyData[], orgName: string, orgEmail: string): string {
  const listings = properties.map(p => {
    const stateAbbr = getStateAbbr(p.address_state);
    const transType = getTransactionType(p.transaction_type);
    const propType = mapPropertyType(p.property_type_name);
    const livingArea = p.area_useful || p.area_built || p.area_total || 0;
    const lotArea = p.area_total || 0;

    // Images
    let mediaItems = '';
    if (p.images.length > 0) {
      p.images.forEach((img, idx) => {
        const primary = img.is_cover || idx === 0 ? ' primary="true"' : '';
        mediaItems += `        <Item medium="image" caption="foto${idx + 1}"${primary}>${escapeXml(img.url)}</Item>\n`;
      });
    }
    if (p.youtube_url) {
      mediaItems += `        <Item medium="video">${escapeXml(p.youtube_url)}</Item>\n`;
    }

    // Features (amenities mapping)
    let featuresXml = '';
    if (p.amenities && p.amenities.length > 0) {
      const featureItems = p.amenities.map(a => `          <Feature>${escapeXml(a)}</Feature>`).join('\n');
      featuresXml = `        <Features>\n${featureItems}\n        </Features>`;
    }

    // Price elements
    let priceXml = '';
    if (p.sale_price && (transType === 'For Sale' || transType === 'Sale/Rent')) {
      priceXml += `        <ListPrice currency="BRL">${Math.round(p.sale_price)}</ListPrice>\n`;
    }
    if (p.rent_price && (transType === 'For Rent' || transType === 'Sale/Rent')) {
      priceXml += `        <RentalPrice currency="BRL" period="Monthly">${Math.round(p.rent_price)}</RentalPrice>\n`;
    }

    const desc = p.description && p.description.length >= 50
      ? p.description.substring(0, 3000)
      : (p.title || 'Imóvel disponível. Entre em contato para mais informações sobre esta excelente oportunidade.');

    return `    <Listing>
      <ListingID>${escapeXml(p.property_code || p.id)}</ListingID>
      <Title>${cdata(p.title || 'Imóvel')}</Title>
      <TransactionType>${transType}</TransactionType>
      <PublicationType>STANDARD</PublicationType>
      <Location displayAddress="All">
        <Country abbreviation="BR">Brasil</Country>
        <State abbreviation="${stateAbbr}">${cdata(p.address_state || '')}</State>
        <City>${cdata(p.address_city || '')}</City>
        <Neighborhood>${cdata(p.address_neighborhood || '')}</Neighborhood>
        <Address>${cdata(p.address_street || '')}</Address>
        <StreetNumber>${escapeXml(p.address_number || '')}</StreetNumber>
        <Complement>${cdata(p.address_complement || '')}</Complement>
        <PostalCode>${escapeXml(p.address_zipcode || '')}</PostalCode>${p.latitude ? `\n        <Latitude>${p.latitude}</Latitude>` : ''}${p.longitude ? `\n        <Longitude>${p.longitude}</Longitude>` : ''}
      </Location>
      <Details>
${priceXml}        <PropertyAdministrationFee currency="BRL">${p.condominium_fee ? Math.round(p.condominium_fee) : 0}</PropertyAdministrationFee>
        <Iptu currency="BRL" period="Yearly">${p.iptu ? Math.round(p.iptu) : 0}</Iptu>
        <Description>${cdata(desc)}</Description>
        <PropertyType>${propType}</PropertyType>
        <LivingArea unit="square metres">${Math.round(livingArea)}</LivingArea>
        <LotArea unit="square metres">${Math.round(lotArea)}</LotArea>
        <Bedrooms>${p.bedrooms || 0}</Bedrooms>
        <Bathrooms>${p.bathrooms || 0}</Bathrooms>
        <Suites>${p.suites || 0}</Suites>
        <Garage type="Parking Spaces">${p.parking_spots || 0}</Garage>
${featuresXml}
      </Details>
      <Media>
${mediaItems || '        <!-- Sem imagens -->'}
      </Media>
      <ContactInfo>
        <Name>${cdata(orgName)}</Name>
        <Email>${escapeXml(orgEmail)}</Email>
      </ContactInfo>
    </Listing>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync"
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd">
  <Header>
    <PublishDate>${new Date().toISOString()}</PublishDate>
  </Header>
  <Listings>
${listings.join('\n')}
  </Listings>
</ListingDataFeed>`;
}

// ===== Chaves na Mão XML =====
function generateChavesNaMaoXml(properties: PropertyData[], orgName: string): string {
  const imoveis = properties.map(p => {
    const tipo = p.transaction_type === 'aluguel' ? 'Locação' : 'Venda';
    const imageElements = p.images.map((img, idx) =>
      `      <Foto${idx + 1}>${escapeXml(img.url)}</Foto${idx + 1}>`
    ).join('\n');

    return `    <Imovel>
      <CodigoImovel>${escapeXml(p.property_code || p.id)}</CodigoImovel>
      <TipoImovel>${escapeXml(p.property_type_name || 'Apartamento')}</TipoImovel>
      <SubTipoImovel>${escapeXml(p.property_type_name || 'Padrão')}</SubTipoImovel>
      <CategoriaImovel>${tipo}</CategoriaImovel>
      <Titulo>${cdata(p.title || 'Imóvel')}</Titulo>
      <Descricao>${cdata(p.description || '')}</Descricao>
      <Endereco>${escapeXml(p.address_street || '')}</Endereco>
      <Numero>${escapeXml(p.address_number || '')}</Numero>
      <Complemento>${escapeXml(p.address_complement || '')}</Complemento>
      <Bairro>${escapeXml(p.address_neighborhood || '')}</Bairro>
      <Cidade>${escapeXml(p.address_city || '')}</Cidade>
      <UF>${getStateAbbr(p.address_state)}</UF>
      <CEP>${escapeXml(p.address_zipcode || '')}</CEP>${p.latitude ? `\n      <Latitude>${p.latitude}</Latitude>` : ''}${p.longitude ? `\n      <Longitude>${p.longitude}</Longitude>` : ''}
      <PrecoVenda>${p.sale_price ? Math.round(p.sale_price) : 0}</PrecoVenda>
      <PrecoLocacao>${p.rent_price ? Math.round(p.rent_price) : 0}</PrecoLocacao>
      <Condominio>${p.condominium_fee ? Math.round(p.condominium_fee) : 0}</Condominio>
      <IPTU>${p.iptu ? Math.round(p.iptu) : 0}</IPTU>
      <AreaTotal>${p.area_total ? Math.round(p.area_total) : 0}</AreaTotal>
      <AreaUtil>${p.area_useful || p.area_built ? Math.round(p.area_useful || p.area_built || 0) : 0}</AreaUtil>
      <Quartos>${p.bedrooms || 0}</Quartos>
      <Suites>${p.suites || 0}</Suites>
      <Banheiros>${p.bathrooms || 0}</Banheiros>
      <Vagas>${p.parking_spots || 0}</Vagas>
      <Fotos>
${imageElements}
      </Fotos>
    </Imovel>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<Carga xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Imoveis>
${imoveis.join('\n')}
  </Imoveis>
</Carga>`;
}

// ===== Imovelweb XML (similar to VRSync but Navent format) =====
function generateImovelwebXml(properties: PropertyData[], orgName: string, orgEmail: string): string {
  // Imovelweb accepts VRSync format, so we reuse it
  return generateVrSyncXml(properties, orgName, orgEmail);
}

// ===== MAIN HANDLER =====
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const feedId = url.searchParams.get('feed_id');
    const portal = url.searchParams.get('portal');

    if (!feedId && !portal) {
      return new Response(
        JSON.stringify({ error: 'feed_id or portal parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let feedConfig: any = null;
    let organizationId: string;

    if (feedId) {
      // A10: Require feed_token for public feed access
      const feedToken = url.searchParams.get('token');
      if (!feedToken) {
        return new Response(
          JSON.stringify({ error: 'Feed token required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch feed config and validate token
      const { data: feed, error: feedError } = await supabase
        .from('portal_feeds')
        .select('*')
        .eq('id', feedId)
        .eq('feed_token', feedToken)
        .single();

      if (feedError || !feed) {
        return new Response(
          JSON.stringify({ error: 'Invalid feed or token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!feed.is_active) {
        return new Response(
          JSON.stringify({ error: 'Feed is inactive' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      feedConfig = feed;
      organizationId = feed.organization_id;
    } else {
      // Need auth for portal-based access
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
      if (authError || !claimsData?.claims) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const userId = claimsData.claims.sub as string;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', userId)
        .single();

      if (!profile?.organization_id) {
        return new Response(
          JSON.stringify({ error: 'No organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      organizationId = profile.organization_id;
    }

    const portalName = feedConfig?.portal_name || portal || 'olx_zap';
    const startTime = Date.now();

    // Fetch organization info
    const { data: org } = await supabase
      .from('organizations')
      .select('name, email')
      .eq('id', organizationId)
      .single();

    const orgName = org?.name || 'Imobiliária';
    const orgEmail = org?.email || 'contato@imobiliaria.com';

    // Build query for properties
    let query = supabase
      .from('properties')
      .select(`
        id, title, property_code, description, transaction_type,
        sale_price, rent_price, condominium_fee, iptu,
        bedrooms, suites, bathrooms, parking_spots,
        area_total, area_built, area_useful,
        address_street, address_number, address_complement,
        address_neighborhood, address_city, address_state, address_zipcode,
        latitude, longitude, amenities, youtube_url, status,
        property_type:property_types(name)
      `)
      .eq('organization_id', organizationId)
      .eq('status', 'disponivel');

    // Apply filters from feed config
    if (feedConfig?.property_filter) {
      const filters = feedConfig.property_filter;
      if (filters.transaction_type) {
        query = query.eq('transaction_type', filters.transaction_type);
      }
      if (filters.neighborhoods && filters.neighborhoods.length > 0) {
        query = query.in('address_neighborhood', filters.neighborhoods);
      }
      if (filters.cities && filters.cities.length > 0) {
        query = query.in('address_city', filters.cities);
      }
    }

    const { data: rawProperties, error: propError } = await query;
    if (propError) throw propError;

    // Fetch images for all properties
    const propertyIds = (rawProperties || []).map(p => p.id);
    let allImages: any[] = [];
    if (propertyIds.length > 0) {
      // Fetch in chunks of 100
      for (let i = 0; i < propertyIds.length; i += 100) {
        const chunk = propertyIds.slice(i, i + 100);
        const { data: imgs } = await supabase
          .from('property_images')
          .select('property_id, url, is_cover')
          .in('property_id', chunk)
          .order('display_order', { ascending: true });
        if (imgs) allImages = allImages.concat(imgs);
      }
    }

    // Group images by property
    const imagesByProperty: Record<string, { url: string; is_cover: boolean }[]> = {};
    for (const img of allImages) {
      if (!imagesByProperty[img.property_id]) imagesByProperty[img.property_id] = [];
      imagesByProperty[img.property_id].push({ url: img.url, is_cover: img.is_cover });
    }

    // Map properties
    const properties: PropertyData[] = (rawProperties || []).map(p => ({
      ...p,
      property_type_name: (p.property_type as any)?.name || null,
      images: imagesByProperty[p.id] || [],
    }));

    // Generate XML based on portal
    let xml: string;
    switch (portalName) {
      case 'olx_zap':
      case 'vivareal':
        xml = generateVrSyncXml(properties, orgName, orgEmail);
        break;
      case 'chavesnamao':
        xml = generateChavesNaMaoXml(properties, orgName);
        break;
      case 'imovelweb':
        xml = generateImovelwebXml(properties, orgName, orgEmail);
        break;
      default:
        xml = generateVrSyncXml(properties, orgName, orgEmail);
    }

    const duration = Date.now() - startTime;

    // Update feed stats and log
    if (feedConfig?.id) {
      await supabase
        .from('portal_feeds')
        .update({
          last_generated_at: new Date().toISOString(),
          total_properties_exported: properties.length,
        })
        .eq('id', feedConfig.id);

      await supabase
        .from('portal_feed_logs')
        .insert({
          feed_id: feedConfig.id,
          properties_count: properties.length,
          errors_count: 0,
          duration_ms: duration,
        });
    }

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Feed generation error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

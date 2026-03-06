
-- 1. Add slug column to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug text;

-- 2. Slugify helper function
CREATE OR REPLACE FUNCTION public.slugify(val text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT lower(regexp_replace(
    regexp_replace(
      translate(val, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiioooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
      '[^a-zA-Z0-9]+', '-', 'g'
    ),
    '(^-+|-+$)', '', 'g'
  ));
$$;

-- 3. Generate slugs for existing orgs (handle duplicates with suffix)
DO $$
DECLARE
  r RECORD;
  base_slug text;
  final_slug text;
  counter int;
BEGIN
  FOR r IN SELECT id, name FROM organizations WHERE slug IS NULL ORDER BY created_at ASC LOOP
    base_slug := public.slugify(r.name);
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'org';
    END IF;
    final_slug := base_slug;
    counter := 1;
    WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = final_slug AND id != r.id) LOOP
      final_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    UPDATE organizations SET slug = final_slug WHERE id = r.id;
  END LOOP;
END $$;

-- 4. Make slug NOT NULL and UNIQUE
ALTER TABLE organizations ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_key ON organizations (slug);

-- 5. Auto-set slug on insert if not provided
CREATE OR REPLACE FUNCTION public.auto_set_org_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int := 1;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := public.slugify(NEW.name);
    IF base_slug = '' OR base_slug IS NULL THEN base_slug := 'org'; END IF;
    final_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = final_slug) LOOP
      final_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_org_slug ON organizations;
CREATE TRIGGER set_org_slug BEFORE INSERT ON organizations
FOR EACH ROW EXECUTE FUNCTION auto_set_org_slug();

-- 6. New RPC: look up property by org slug + property code
CREATE OR REPLACE FUNCTION public.get_public_property_by_org_code(p_org_slug text, p_property_code text)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_id uuid;
  v_property RECORD;
  v_broker RECORD;
  v_share_link RECORD;
  v_images json;
  v_media json;
  v_property_type text;
  result json;
BEGIN
  -- 1. Find org by slug
  SELECT id INTO v_org_id FROM organizations WHERE slug = p_org_slug;
  IF v_org_id IS NULL THEN RETURN NULL; END IF;

  -- 2. Find property by org + code
  SELECT
    p.id, p.title, p.description, p.property_type_id, p.transaction_type, p.status,
    p.sale_price, p.rent_price, p.condominium_fee, p.iptu,
    p.bedrooms, p.suites, p.bathrooms, p.parking_spots,
    p.area_total, p.area_built, p.amenities,
    p.address_neighborhood, p.address_city, p.address_state,
    p.youtube_url, p.property_condition, p.floor, p.property_code
  INTO v_property
  FROM properties p
  WHERE p.organization_id = v_org_id AND p.property_code = p_property_code;

  IF v_property IS NULL THEN RETURN NULL; END IF;

  -- 3. Get property type
  SELECT name INTO v_property_type FROM property_types WHERE id = v_property.property_type_id;

  -- 4. Get most recent active share link broker
  SELECT psl.broker_id INTO v_share_link
  FROM property_share_links psl
  WHERE psl.property_id = v_property.id AND psl.active = true
  ORDER BY psl.created_at DESC LIMIT 1;

  IF v_share_link IS NOT NULL THEN
    SELECT pr.full_name, pr.phone, pr.avatar_url INTO v_broker
    FROM profiles pr WHERE pr.user_id = v_share_link.broker_id;
  END IF;

  -- 5. Get images with R2 fields
  SELECT COALESCE(json_agg(json_build_object(
    'id', pi.id,
    'url', pi.url,
    'is_cover', pi.is_cover,
    'display_order', pi.display_order,
    'r2_key_full', pi.r2_key_full,
    'r2_key_thumb', pi.r2_key_thumb,
    'storage_provider', pi.storage_provider,
    'cached_thumbnail_url', pi.cached_thumbnail_url
  ) ORDER BY pi.display_order ASC NULLS LAST), '[]'::json)
  INTO v_images
  FROM property_images pi WHERE pi.property_id = v_property.id;

  -- 6. Get media fallback
  SELECT COALESCE(json_agg(json_build_object(
    'id', pm.id,
    'url', COALESCE(pm.stored_url, pm.original_url),
    'display_order', pm.display_order
  ) ORDER BY pm.display_order ASC NULLS LAST), '[]'::json)
  INTO v_media
  FROM property_media pm WHERE pm.property_id = v_property.id;

  -- 7. Build response
  result := json_build_object(
    'property', json_build_object(
      'id', v_property.id,
      'title', v_property.title,
      'description', v_property.description,
      'property_type', v_property_type,
      'transaction_type', v_property.transaction_type,
      'status', v_property.status,
      'sale_price', v_property.sale_price,
      'rent_price', v_property.rent_price,
      'condominium_fee', v_property.condominium_fee,
      'iptu', v_property.iptu,
      'bedrooms', v_property.bedrooms,
      'suites', v_property.suites,
      'bathrooms', v_property.bathrooms,
      'parking_spots', v_property.parking_spots,
      'area_total', v_property.area_total,
      'area_built', v_property.area_built,
      'amenities', v_property.amenities,
      'neighborhood', v_property.address_neighborhood,
      'city', v_property.address_city,
      'state', v_property.address_state,
      'youtube_url', v_property.youtube_url,
      'property_condition', v_property.property_condition,
      'floor', v_property.floor,
      'property_code', v_property.property_code
    ),
    'images', v_images,
    'media', v_media,
    'broker', json_build_object(
      'name', v_broker.full_name,
      'phone', v_broker.phone,
      'avatar_url', v_broker.avatar_url
    )
  );

  RETURN result;
END;
$$;

-- 7. Also update the old RPC to return R2 image fields + property_code
CREATE OR REPLACE FUNCTION public.get_public_property_by_slug(p_slug text)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_link RECORD;
  v_property RECORD;
  v_broker RECORD;
  v_images json;
  v_media json;
  v_property_type text;
  result json;
BEGIN
  SELECT * INTO v_link
  FROM property_share_links
  WHERE slug = p_slug AND active = true
    AND (expires_at IS NULL OR expires_at > now());
  IF v_link IS NULL THEN RETURN NULL; END IF;

  SELECT p.id, p.title, p.description, p.property_type_id, p.transaction_type, p.status,
    p.sale_price, p.rent_price, p.condominium_fee, p.iptu,
    p.bedrooms, p.suites, p.bathrooms, p.parking_spots,
    p.area_total, p.area_built, p.amenities,
    p.address_neighborhood, p.address_city, p.address_state,
    p.youtube_url, p.property_condition, p.floor, p.property_code
  INTO v_property
  FROM properties p WHERE p.id = v_link.property_id;
  IF v_property IS NULL THEN RETURN NULL; END IF;

  SELECT name INTO v_property_type FROM property_types WHERE id = v_property.property_type_id;

  SELECT pr.full_name, pr.phone, pr.avatar_url INTO v_broker
  FROM profiles pr WHERE pr.user_id = v_link.broker_id;

  SELECT COALESCE(json_agg(json_build_object(
    'id', pi.id, 'url', pi.url, 'is_cover', pi.is_cover, 'display_order', pi.display_order,
    'r2_key_full', pi.r2_key_full, 'r2_key_thumb', pi.r2_key_thumb,
    'storage_provider', pi.storage_provider, 'cached_thumbnail_url', pi.cached_thumbnail_url
  ) ORDER BY pi.display_order ASC NULLS LAST), '[]'::json)
  INTO v_images FROM property_images pi WHERE pi.property_id = v_link.property_id;

  SELECT COALESCE(json_agg(json_build_object(
    'id', pm.id, 'url', COALESCE(pm.stored_url, pm.original_url), 'display_order', pm.display_order
  ) ORDER BY pm.display_order ASC NULLS LAST), '[]'::json)
  INTO v_media FROM property_media pm WHERE pm.property_id = v_link.property_id;

  result := json_build_object(
    'property', json_build_object(
      'id', v_property.id, 'title', v_property.title, 'description', v_property.description,
      'property_type', v_property_type, 'transaction_type', v_property.transaction_type,
      'status', v_property.status, 'sale_price', v_property.sale_price,
      'rent_price', v_property.rent_price, 'condominium_fee', v_property.condominium_fee,
      'iptu', v_property.iptu, 'bedrooms', v_property.bedrooms, 'suites', v_property.suites,
      'bathrooms', v_property.bathrooms, 'parking_spots', v_property.parking_spots,
      'area_total', v_property.area_total, 'area_built', v_property.area_built,
      'amenities', v_property.amenities, 'neighborhood', v_property.address_neighborhood,
      'city', v_property.address_city, 'state', v_property.address_state,
      'youtube_url', v_property.youtube_url, 'property_condition', v_property.property_condition,
      'floor', v_property.floor, 'property_code', v_property.property_code
    ),
    'images', v_images,
    'media', v_media,
    'broker', json_build_object(
      'name', v_broker.full_name,
      'phone', v_broker.phone,
      'avatar_url', v_broker.avatar_url
    )
  );
  RETURN result;
END;
$$;

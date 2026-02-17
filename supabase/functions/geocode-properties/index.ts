import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Property {
  id: string;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zipcode: string | null;
  latitude: number | null;
  longitude: number | null;
  geocode_status: string | null;
  geocode_hash: string | null;
  organization_id: string;
}

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase();
}

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildAddressCandidates(p: Property): string[] {
  const street = p.address_street ?? "";
  const number = p.address_number ?? "";
  const neighborhood = p.address_neighborhood ?? "";
  const city = p.address_city ?? "";
  const state = p.address_state ?? "";
  const cep = (p.address_zipcode ?? "").replace(/\D/g, "");

  const candidates = [
    [street, number, neighborhood, city, state, cep, "Brasil"],
    [street, number, city, state, "Brasil"],
    [street, neighborhood, city, state, "Brasil"],
    [neighborhood, city, state, "Brasil"],
    [city, state, "Brasil"],
  ];

  return candidates
    .map((parts) => normalize(parts.filter(Boolean).join(", ")))
    .filter((a) => a.length >= 10);
}

async function nominatimGeocode(query: string): Promise<{
  lat: number;
  lng: number;
  precision: string;
} | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("accept-language", "pt-BR");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Habitae/1.0 (geocoding)" },
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const result = data[0];
  const lat = parseFloat(result.lat);
  const lng = parseFloat(result.lon);

  if (isNaN(lat) || isNaN(lng)) return null;

  // Determine precision from result type
  const type = (result.type ?? "").toLowerCase();
  const category = (result.category ?? "").toLowerCase();
  let precision = "city";
  if (type === "house" || type === "building") precision = "rooftop";
  else if (type === "street" || category === "highway") precision = "street";
  else if (type === "suburb" || type === "neighbourhood") precision = "neighborhood";

  return { lat, lng, precision };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate JWT
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const propertyIds: string[] | undefined = body.property_ids;
    const organizationId: string | undefined = body.organization_id;
    const force: boolean = !!body.force;
    const batchSize: number = Math.min(body.batch_size ?? 20, 50);

    // Build query
    let q = supabase
      .from("properties")
      .select(
        "id, address_street, address_number, address_neighborhood, address_city, address_state, address_zipcode, latitude, longitude, geocode_status, geocode_hash, organization_id"
      )
      .limit(batchSize);

    if (propertyIds?.length) {
      q = q.in("id", propertyIds);
    } else {
      if (organizationId) q = q.eq("organization_id", organizationId);
      if (!force) {
        q = q.or("geocode_status.eq.pending,geocode_status.is.null");
      }
      q = q.or("latitude.is.null,longitude.is.null");
    }

    const { data: props, error } = await q;
    if (error) throw error;

    const results: Array<{
      id: string;
      status: string;
      precision?: string;
      reason?: string;
    }> = [];

    for (const p of (props ?? []) as Property[]) {
      if (!force && p.latitude != null && p.longitude != null) {
        results.push({ id: p.id, status: "skipped", reason: "already_geocoded" });
        continue;
      }

      const candidates = buildAddressCandidates(p);
      if (!candidates.length) {
        await supabase
          .from("properties")
          .update({
            geocode_status: "failed",
            geocode_error: "Endereço insuficiente",
            geocoded_at: new Date().toISOString(),
            geocode_provider: "nominatim",
          })
          .eq("id", p.id);
        results.push({ id: p.id, status: "failed", reason: "insufficient_address" });
        continue;
      }

      const hash = await sha1Hex(candidates[0]);
      if (!force && p.geocode_hash === hash && p.geocode_status === "failed") {
        results.push({ id: p.id, status: "skipped", reason: "same_hash_failed" });
        continue;
      }

      let found = null;

      for (const candidate of candidates) {
        // Rate limit: 1 request per second for Nominatim
        await delay(1100);

        try {
          const result = await nominatimGeocode(candidate);
          if (result) {
            found = result;
            break;
          }
        } catch {
          // Try next candidate
        }
      }

      if (!found) {
        await supabase
          .from("properties")
          .update({
            geocode_status: "failed",
            geocode_error: `Não encontrado. Último candidato: ${candidates[candidates.length - 1]}`,
            geocoded_at: new Date().toISOString(),
            geocode_provider: "nominatim",
            geocode_hash: hash,
          })
          .eq("id", p.id);
        results.push({ id: p.id, status: "failed" });
        continue;
      }

      await supabase
        .from("properties")
        .update({
          latitude: found.lat,
          longitude: found.lng,
          geocode_status: found.precision === "rooftop" || found.precision === "street" ? "ok" : "partial",
          geocode_precision: found.precision,
          geocoded_at: new Date().toISOString(),
          geocode_provider: "nominatim",
          geocode_hash: hash,
          geocode_error: null,
        })
        .eq("id", p.id);

      results.push({ id: p.id, status: "ok", precision: found.precision });
    }

    return new Response(
      JSON.stringify({ ok: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "content-type": "application/json" }, status: 200 }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e) }),
      { headers: { ...corsHeaders, "content-type": "application/json" }, status: 500 }
    );
  }
});

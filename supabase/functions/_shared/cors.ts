const DEFAULT_ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function getAllowedOrigins(): string[] {
  const rawOrigins = Deno.env.get("APP_ALLOWED_ORIGINS")?.trim();

  if (!rawOrigins) {
    throw new Error("APP_ALLOWED_ORIGINS must be configured");
  }

  const origins = rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error("APP_ALLOWED_ORIGINS must include at least one origin");
  }

  return origins;
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = req.headers.get("Origin")?.trim();

  const allowedOrigin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Vary": "Origin",
  };
}

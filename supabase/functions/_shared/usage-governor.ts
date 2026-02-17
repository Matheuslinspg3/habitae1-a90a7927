import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

type LimitConfig = {
  max_requests: number;
  window_seconds: number;
  burst_threshold: number;
  burst_window_seconds: number;
  cooldown_seconds: number;
};

type EnforceInput = {
  supabase: SupabaseClient;
  functionName: string;
  userId?: string | null;
  organizationId?: string | null;
  metadata?: Record<string, unknown>;
};

type EnforceResult = {
  allowed: boolean;
  reason: string | null;
  retryAfterSeconds: number;
  config: LimitConfig;
  windowCount: number;
  burstCount: number;
};

const DEFAULT_LIMITS: Record<string, LimitConfig> = {
  "imobzi-process": { max_requests: 50, window_seconds: 3600, burst_threshold: 6, burst_window_seconds: 120, cooldown_seconds: 600 },
  "extract-property-pdf": { max_requests: 80, window_seconds: 3600, burst_threshold: 10, burst_window_seconds: 120, cooldown_seconds: 600 },
  "cloudinary-purge": { max_requests: 5, window_seconds: 3600, burst_threshold: 2, burst_window_seconds: 300, cooldown_seconds: 1800 },
  "scrape-drive-photos": { max_requests: 120, window_seconds: 3600, burst_threshold: 20, burst_window_seconds: 120, cooldown_seconds: 600 },
};

async function resolveOrgId(supabase: SupabaseClient, userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase.from("profiles").select("organization_id").eq("user_id", userId).maybeSingle();
  return data?.organization_id ?? null;
}

export async function enforceUsageLimit(input: EnforceInput): Promise<EnforceResult> {
  const orgId = input.organizationId ?? await resolveOrgId(input.supabase, input.userId);

  const { data: limits } = await input.supabase
    .from("function_usage_limits")
    .select("max_requests, window_seconds, burst_threshold, burst_window_seconds, cooldown_seconds, organization_id, user_id")
    .eq("function_name", input.functionName)
    .eq("is_active", true)
    .order("user_id", { ascending: false, nullsFirst: false })
    .order("organization_id", { ascending: false, nullsFirst: false });

  const config = limits?.find((limit: any) => {
    if (limit.user_id && limit.user_id !== input.userId) return false;
    if (limit.organization_id && limit.organization_id !== orgId) return false;
    return true;
  }) ?? DEFAULT_LIMITS[input.functionName];

  const now = new Date();
  const { data: activeBlock } = await input.supabase
    .from("function_usage_blocks")
    .select("blocked_until")
    .eq("function_name", input.functionName)
    .is("organization_id", orgId)
    .is("user_id", input.userId ?? null)
    .gt("blocked_until", now.toISOString())
    .maybeSingle();

  if (activeBlock?.blocked_until) {
    const retryAfter = Math.max(1, Math.ceil((new Date(activeBlock.blocked_until).getTime() - now.getTime()) / 1000));
    return { allowed: false, reason: "cooldown_active", retryAfterSeconds: retryAfter, config, windowCount: 0, burstCount: 0 };
  }

  const windowStart = new Date(now.getTime() - config.window_seconds * 1000).toISOString();
  const burstStart = new Date(now.getTime() - config.burst_window_seconds * 1000).toISOString();

  const buildCountQuery = (since: string) => input.supabase
    .from("function_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("function_name", input.functionName)
    .eq("allowed", true)
    .is("organization_id", orgId)
    .is("user_id", input.userId ?? null)
    .gte("created_at", since);

  const [windowRes, burstRes] = await Promise.all([
    buildCountQuery(windowStart),
    buildCountQuery(burstStart),
  ]);

  const windowCount = windowRes.count ?? 0;
  const burstCount = burstRes.count ?? 0;

  if (windowCount >= config.max_requests) {
    return { allowed: false, reason: "window_limit_exceeded", retryAfterSeconds: config.window_seconds, config, windowCount, burstCount };
  }

  if (burstCount >= config.burst_threshold) {
    const blockedUntil = new Date(now.getTime() + config.cooldown_seconds * 1000).toISOString();
    await input.supabase.from("function_usage_blocks").upsert({
      function_name: input.functionName,
      organization_id: orgId,
      user_id: input.userId ?? null,
      reason: "burst_anomaly",
      blocked_until: blockedUntil,
      metadata: input.metadata ?? {},
    });
    return { allowed: false, reason: "burst_anomaly", retryAfterSeconds: config.cooldown_seconds, config, windowCount, burstCount };
  }

  return { allowed: true, reason: null, retryAfterSeconds: 0, config, windowCount, burstCount };
}

export async function trackUsageEvent(input: {
  supabase: SupabaseClient;
  functionName: string;
  userId?: string | null;
  organizationId?: string | null;
  allowed: boolean;
  reason?: string | null;
  responseStatus?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}) {
  const orgId = input.organizationId ?? await resolveOrgId(input.supabase, input.userId);
  await input.supabase.from("function_usage_events").insert({
    function_name: input.functionName,
    organization_id: orgId,
    user_id: input.userId ?? null,
    allowed: input.allowed,
    reason: input.reason ?? null,
    response_status: input.responseStatus ?? null,
    duration_ms: input.durationMs ?? null,
    metadata: input.metadata ?? {},
  });
}

export function createServiceClient() {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
}

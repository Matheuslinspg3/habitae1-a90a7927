import { createClient } from "npm:@supabase/supabase-js@2";
import { assertTargetUserInScope, assertTenantScope, isPlatformAuthorized } from "./security.ts";

const ALLOWED_ORIGINS = (Deno.env.get("APP_ALLOWED_ORIGINS") || "").split(",").map((s) => s.trim()).filter(Boolean);
const PLATFORM_ADMIN_USER_IDS = new Set(
  (Deno.env.get("PLATFORM_ADMIN_USER_IDS") || "").split(",").map((s) => s.trim()).filter(Boolean),
);
const PLATFORM_ADMIN_ROLE = Deno.env.get("PLATFORM_ADMIN_ROLE") || "platform_admin";
const PLATFORM_CONTROLLER_ORG_ID = Deno.env.get("PLATFORM_CONTROLLER_ORG_ID") || "";
const RATE_LIMIT_PER_MIN = Number(Deno.env.get("ADMIN_USERS_RATE_LIMIT_PER_MIN") || "60");

const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

function getClientIp(req: Request) {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function ensureWithinRateLimit(req: Request) {
  const key = getClientIp(req);
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || now - current.windowStart >= 60_000) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return;
  }

  if (current.count >= RATE_LIMIT_PER_MIN) {
    throw new Error("Too Many Requests");
  }

  current.count += 1;
  rateLimitStore.set(key, current);
}

type ClaimsClient = {
  auth: {
    getClaims: (token: string) => Promise<{ data: { claims?: { sub?: string } }; error: Error | null }>;
  };
};

type AdminClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: any; error: Error | null }>;
      };
      in?: (column: string, values: string[]) => Promise<{ data: any[] | null; error: Error | null }>;
    };
    delete: () => { eq: (column: string, value: string) => Promise<{ error: Error | null }> };
    update: (payload: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<{ error: Error | null }> };
  };
  auth: {
    admin: {
      listUsers: (params: { perPage: number }) => Promise<{ data: { users: Array<{ id: string; email?: string; created_at?: string }> }; error: Error | null }>;
      deleteUser: (userId: string) => Promise<{ error: Error | null }>;
    };
  };
};

export async function validatePlatformAuthorization(adminClient: AdminClient, userId: string) {
  const { data: userRoles, error } = await (adminClient
    .from("user_roles")
    .select("role,organization_id")
    .eq("user_id", userId) as unknown as Promise<{ data: Array<{ role: string; organization_id?: string | null }>; error: Error | null }>);

  if (error) {
    throw error;
  }

  return isPlatformAuthorized({
    userId,
    userRoles: userRoles || [],
    platformAdminUserIds: PLATFORM_ADMIN_USER_IDS,
    platformAdminRole: PLATFORM_ADMIN_ROLE,
    platformControllerOrgId: PLATFORM_CONTROLLER_ORG_ID,
  });
}

export async function handleAdminUsersRequest(
  req: Request,
  deps?: { createClaimsClient?: (authHeader: string) => ClaimsClient; createAdminClient?: () => AdminClient },
) {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let actorId = "unknown";
  let scopeOrgId = "";
  let targetUserId = "";

  try {
    ensureWithinRateLimit(req);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const claimsClient = deps?.createClaimsClient
      ? deps.createClaimsClient(authHeader)
      : createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } }) as unknown as ClaimsClient;

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await claimsClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) throw new Error("Unauthorized");
    actorId = claimsData.claims.sub;

    const adminClient = deps?.createAdminClient
      ? deps.createAdminClient()
      : createClient(supabaseUrl, serviceKey) as unknown as AdminClient;

    const authorized = await validatePlatformAuthorization(adminClient, actorId);
    if (!authorized) throw new Error("Forbidden: platform authorization required");

    if (req.method === "GET") {
      scopeOrgId = new URL(req.url).searchParams.get("organization_id") || "";
      assertTenantScope(scopeOrgId);

      const { data: scopedProfiles, error: scopedProfilesError } = await (adminClient
        .from("profiles")
        .select("user_id")
        .eq("organization_id", scopeOrgId) as unknown as Promise<{ data: Array<{ user_id: string }>; error: Error | null }>);

      if (scopedProfilesError) throw scopedProfilesError;
      const scopedUserIds = (scopedProfiles || []).map((profile) => profile.user_id);
      if (scopedUserIds.length === 0) {
        console.info("[admin-users:audit]", { action: "GET", actorId, scopeOrgId, result: "success", count: 0 });
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;

      const scopedSet = new Set(scopedUserIds);
      const simplifiedUsers = users
        .filter((u) => scopedSet.has(u.id))
        .map((u) => ({ id: u.id, email: u.email, created_at: u.created_at }));

      console.info("[admin-users:audit]", { action: "GET", actorId, scopeOrgId, result: "success", count: simplifiedUsers.length });
      return new Response(JSON.stringify(simplifiedUsers), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      const body = await req.json();
      targetUserId = body?.user_id;
      scopeOrgId = body?.organization_id;

      if (!targetUserId) throw new Error("user_id required");
      if (targetUserId === actorId) throw new Error("Cannot delete yourself");

      assertTenantScope(scopeOrgId);

      const { data: targetProfile, error: targetProfileError } = await (adminClient
        .from("profiles")
        .select("organization_id")
        .eq("user_id", targetUserId)
        .maybeSingle() as unknown as Promise<{ data: { organization_id?: string | null } | null; error: Error | null }>);

      if (targetProfileError) throw targetProfileError;
      assertTargetUserInScope({ requestedOrganizationId: scopeOrgId, targetOrganizationId: targetProfile?.organization_id });

      await Promise.all([
        adminClient.from("user_roles").delete().eq("user_id", targetUserId),
        adminClient.from("profiles").delete().eq("user_id", targetUserId),
        adminClient.from("organizations").update({ created_by: null }).eq("created_by", targetUserId),
        adminClient.from("organization_invites").delete().eq("invited_by", targetUserId),
        adminClient.from("properties").update({ created_by: null } as never).eq("created_by", targetUserId),
        adminClient.from("properties").update({ captador_id: null } as never).eq("captador_id", targetUserId),
        adminClient.from("leads").update({ created_by: null } as never).eq("created_by", targetUserId),
        adminClient.from("leads").update({ broker_id: null } as never).eq("broker_id", targetUserId),
        adminClient.from("lead_interactions").delete().eq("created_by", targetUserId),
        adminClient.from("contracts").update({ created_by: null } as never).eq("created_by", targetUserId),
        adminClient.from("contracts").update({ broker_id: null } as never).eq("broker_id", targetUserId),
        adminClient.from("contract_documents").delete().eq("uploaded_by", targetUserId),
        adminClient.from("invoices").update({ created_by: null } as never).eq("created_by", targetUserId),
        adminClient.from("commissions").update({ broker_id: null } as never).eq("broker_id", targetUserId),
        adminClient.from("appointments").update({ created_by: null } as never).eq("created_by", targetUserId),
        adminClient.from("appointments").update({ assigned_to: null }).eq("assigned_to", targetUserId),
        adminClient.from("tasks").update({ created_by: null } as never).eq("created_by", targetUserId),
        adminClient.from("tasks").update({ assigned_to: null } as never).eq("assigned_to", targetUserId),
      ]);

      const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (error) throw new Error(`Delete user failed: ${error.message}`);

      console.info("[admin-users:audit]", { action: "DELETE", actorId, scopeOrgId, targetUserId, result: "success" });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Forbidden")
      ? 403
      : msg.includes("Unauthorized") || msg.includes("No auth")
      ? 401
      : msg.includes("Too Many Requests")
      ? 429
      : 400;

    const safeMsg = msg.includes("Forbidden")
      ? "Forbidden"
      : msg.includes("Unauthorized") || msg.includes("No auth")
      ? "Unauthorized"
      : msg.includes("Too Many Requests")
      ? "Too Many Requests"
      : "Erro interno";

    console.error("[admin-users] Error:", msg);
    console.info("[admin-users:audit]", { action: req.method, actorId, scopeOrgId, targetUserId, result: "denied", reason: safeMsg });

    return new Response(JSON.stringify({ error: safeMsg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleAdminUsersRequest(req));
}

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Unauthorized");
    const callerId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get caller's profile and role
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", callerId)
      .single();

    if (!callerProfile?.organization_id) throw new Error("No organization");

    // Check caller is admin or above
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);

    const callerRoleList = (callerRoles || []).map((r: any) => r.role);
    const isAdmin = callerRoleList.some((r: string) => ["admin", "sub_admin", "developer", "leader"].includes(r));
    if (!isAdmin) throw new Error("Forbidden");

    const body = await req.json();
    const { action } = body;

    if (action === "remove_member") {
      const { user_id: targetId, reason } = body;
      if (!targetId) throw new Error("user_id required");
      if (targetId === callerId) throw new Error("Cannot remove yourself");

      // Check target is in same org
      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("organization_id, full_name")
        .eq("user_id", targetId)
        .single();

      if (!targetProfile || targetProfile.organization_id !== callerProfile.organization_id) {
        throw new Error("User not in your organization");
      }

      // Check target's role - can't remove developer/leader unless caller is developer
      const { data: targetRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", targetId);

      const targetRoleList = (targetRoles || []).map((r: any) => r.role);
      const isDeveloper = callerRoleList.includes("developer");
      if (targetRoleList.includes("developer") && !isDeveloper) {
        throw new Error("Cannot remove a developer");
      }
      if (targetRoleList.includes("admin") && !isDeveloper) {
        throw new Error("Cannot remove an admin");
      }

      // Log the removal event
      await adminClient.from("organization_member_events").insert({
        organization_id: callerProfile.organization_id,
        user_id: targetId,
        event_type: "removed",
        performed_by: callerId,
        reason: reason || null,
        metadata: { member_name: targetProfile.full_name, roles: targetRoleList },
      });

      // Remove from organization (set org_id to null, set removed_at)
      await adminClient
        .from("profiles")
        .update({ organization_id: null, removed_at: new Date().toISOString(), custom_role_id: null })
        .eq("user_id", targetId);

      // Remove roles
      await adminClient.from("user_roles").delete().eq("user_id", targetId);

      // Unassign from leads
      await adminClient
        .from("leads")
        .update({ broker_id: null })
        .eq("broker_id", targetId)
        .eq("organization_id", callerProfile.organization_id);

      // Unassign from tasks
      await adminClient
        .from("tasks")
        .update({ assigned_to: null } as any)
        .eq("assigned_to", targetId)
        .eq("organization_id", callerProfile.organization_id);

      return new Response(JSON.stringify({ success: true, name: targetProfile.full_name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_member_stats") {
      const orgId = callerProfile.organization_id;

      // Get all members with their stats
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("user_id, full_name, created_at, custom_role_id")
        .eq("organization_id", orgId);

      if (!profiles?.length) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userIds = profiles.map((p: any) => p.user_id);

      // Get auth info (last sign in)
      const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const authMap = new Map(users.map((u) => [u.id, { last_sign_in_at: u.last_sign_in_at, email: u.email }]));

      // Get roles
      const { data: roles } = await adminClient
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      // Get activity counts (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: activities } = await adminClient
        .from("activity_log")
        .select("user_id, action_type, entity_type")
        .eq("organization_id", orgId)
        .gte("created_at", thirtyDaysAgo)
        .in("user_id", userIds);

      // Get leads per broker
      const { data: leads } = await adminClient
        .from("leads")
        .select("broker_id")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .in("broker_id", userIds);

      // Get contracts per broker
      const { data: contracts } = await adminClient
        .from("contracts")
        .select("broker_id")
        .eq("organization_id", orgId)
        .in("broker_id", userIds);

      // Get properties created
      const { data: properties } = await adminClient
        .from("properties")
        .select("created_by")
        .eq("organization_id", orgId)
        .in("created_by", userIds);

      const result = profiles.map((p: any) => {
        const auth = authMap.get(p.user_id);
        const userRoles = (roles || []).filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role);
        const userActivities = (activities || []).filter((a: any) => a.user_id === p.user_id);
        const userLeads = (leads || []).filter((l: any) => l.broker_id === p.user_id).length;
        const userContracts = (contracts || []).filter((c: any) => c.broker_id === p.user_id).length;
        const userProperties = (properties || []).filter((pr: any) => pr.created_by === p.user_id).length;

        return {
          user_id: p.user_id,
          full_name: p.full_name,
          email: auth?.email || null,
          last_sign_in_at: auth?.last_sign_in_at || null,
          joined_at: p.created_at,
          roles: userRoles.length > 0 ? userRoles : ["corretor"],
          custom_role_id: p.custom_role_id,
          total_actions_30d: userActivities.length,
          active_leads: userLeads,
          total_contracts: userContracts,
          total_properties: userProperties,
          actions_by_type: userActivities.reduce((acc: any, a: any) => {
            acc[a.action_type] = (acc[a.action_type] || 0) + 1;
            return acc;
          }, {}),
        };
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Forbidden") ? 403 : msg.includes("Unauthorized") ? 401 : 400;
    console.error("[manage-member]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

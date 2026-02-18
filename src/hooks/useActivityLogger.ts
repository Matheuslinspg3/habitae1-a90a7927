import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type ActionType = "viewed" | "updated" | "created" | "deleted" | "assigned" | "stage_changed" | "interaction";
type EntityType = "lead" | "property" | "task" | "contract" | "appointment";

interface LogActivityParams {
  actionType: ActionType;
  entityType: EntityType;
  entityId: string;
  entityName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hook to log user activities to the activity_log table.
 * Includes deduplication to avoid spamming "viewed" events.
 */
export function useActivityLogger() {
  const { user, profile } = useAuth();
  const recentViews = useRef<Map<string, number>>(new Map());

  const logActivity = useCallback(
    async ({ actionType, entityType, entityId, entityName, metadata }: LogActivityParams) => {
      if (!user || !profile?.organization_id) return;

      // Deduplicate "viewed" events: skip if same entity viewed within last 60s
      if (actionType === "viewed") {
        const key = `${entityType}:${entityId}`;
        const lastViewed = recentViews.current.get(key);
        const now = Date.now();
        if (lastViewed && now - lastViewed < 60_000) return;
        recentViews.current.set(key, now);
      }

      try {
        await supabase.from("activity_log").insert({
          organization_id: profile.organization_id,
          user_id: user.id,
          action_type: actionType,
          entity_type: entityType,
          entity_id: entityId,
          entity_name: entityName || "",
          metadata: metadata ? metadata as any : {},
        });
      } catch {
        // Silent fail – activity logging should never break the app
      }
    },
    [user, profile]
  );

  return { logActivity };
}
